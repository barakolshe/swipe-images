import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

type SwipeableCardProps = {
  imageUri: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  index: number;
  undoAnimation?: { trigger: number; wasLeftSwipe: boolean } | null;
};

export function SwipeableCard({
  imageUri,
  onSwipeLeft,
  onSwipeRight,
  index,
  undoAnimation,
}: SwipeableCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const isUndoing = useSharedValue(0);
  const lastTriggerRef = useRef(0);

  // Handle undo animation
  useEffect(() => {
    if (
      undoAnimation &&
      undoAnimation.trigger > 0 &&
      undoAnimation.trigger !== lastTriggerRef.current
    ) {
      lastTriggerRef.current = undoAnimation.trigger;

      // Mark that we're undoing to suppress overlays
      isUndoing.value = 1;

      // Start from the swiped position (off-screen)
      const startX = undoAnimation.wasLeftSwipe
        ? -SCREEN_WIDTH * 2
        : SCREEN_WIDTH * 2;
      translateX.value = startX;
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 0.9;

      // Animate back to center with smooth timing (no bounce)
      translateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
      scale.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });

      // Reset isUndoing after animation completes
      isUndoing.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });

      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [undoAnimation?.trigger, undoAnimation?.wasLeftSwipe]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.1; // Reduce vertical movement
      const rotation = interpolate(
        translateX.value,
        [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        [-15, 0, 15]
      );
      scale.value = withSpring(
        1 - (Math.abs(translateX.value) / SCREEN_WIDTH) * 0.1
      );
    })
    .onEnd((event) => {
      const shouldSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
      const shouldSwipeRight = event.translationX > SWIPE_THRESHOLD;

      if (shouldSwipeLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH * 2);
        translateY.value = withSpring(event.translationY);
        opacity.value = withSpring(0);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onSwipeLeft)();
      } else if (shouldSwipeRight) {
        translateX.value = withSpring(SCREEN_WIDTH * 2);
        translateY.value = withSpring(event.translationY);
        opacity.value = withSpring(0);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(onSwipeRight)();
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0]
    );
    // Hide overlay during undo animation
    const opacity = isUndoing.value > 0 ? 0 : baseOpacity;
    return { opacity };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1]
    );
    // Hide overlay during undo animation
    const opacity = isUndoing.value > 0 ? 0 : baseOpacity;
    return { opacity };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.card, animatedCardStyle, { zIndex: 100 - index }]}
      >
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          contentFit="cover"
        />
        <Animated.View
          style={[styles.overlay, styles.leftOverlay, leftOverlayStyle]}
        >
          <View style={styles.deleteBadge}>
            <Animated.Text style={styles.badgeText}>DELETE</Animated.Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[styles.overlay, styles.rightOverlay, rightOverlayStyle]}
        >
          <View style={styles.keepBadge}>
            <Animated.Text style={styles.badgeText}>KEEP</Animated.Text>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: "absolute",
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  leftOverlay: {
    backgroundColor: "rgba(255, 0, 0, 0.3)",
  },
  rightOverlay: {
    backgroundColor: "rgba(0, 255, 0, 0.3)",
  },
  deleteBadge: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#fff",
  },
  keepBadge: {
    backgroundColor: "#44ff44",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
});
