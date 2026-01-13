import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomNavBar } from "@/components/bottom-nav-bar";
import { ImageAsset, useImageSwipe } from "@/contexts/image-swipe-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const BOTTOM_NAV_HEIGHT = 77; // Height of bottom navigation bar

// Memoized gallery item component
const GalleryItem = React.memo(
  ({
    item,
    isMarkedForDeletion,
    isMarkedForKeep,
    onPress,
  }: {
    item: ImageAsset;
    isMarkedForDeletion: boolean;
    isMarkedForKeep: boolean;
    onPress: (imageId: string) => void;
  }) => {
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => onPress(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="cover"
        />
        {(isMarkedForDeletion || isMarkedForKeep) && (
          <View
            style={[
              styles.overlay,
              isMarkedForDeletion ? styles.deletionOverlay : styles.keepOverlay,
            ]}
          />
        )}
      </TouchableOpacity>
    );
  }
);

GalleryItem.displayName = "GalleryItem";

export default function GalleryScreen() {
  const router = useRouter();
  const {
    markedForDeletion,
    markedForKeep,
    images,
    imagesLoading,
    permissionGranted,
  } = useImageSwipe();

  const handleImagePress = useCallback(
    (imageId: string) => {
      router.push({
        pathname: "/",
        params: { startImageId: imageId },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ImageAsset }) => {
      const isMarkedForDeletion = markedForDeletion.has(item.id);
      const isMarkedForKeep = markedForKeep.has(item.id);

      return (
        <GalleryItem
          item={item}
          isMarkedForDeletion={isMarkedForDeletion}
          isMarkedForKeep={isMarkedForKeep}
          onPress={handleImagePress}
        />
      );
    },
    [markedForDeletion, markedForKeep, handleImagePress]
  );

  // Only show loading screen if we're actually loading AND don't have images
  if (imagesLoading && images.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>
          Loading your photos...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!permissionGranted) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Permission Required
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Please grant photo library access to use this app.
        </ThemedText>
      </ThemedView>
    );
  }

  if (images.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          No Images Found
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          No photos were found in your library.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Photo Gallery
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Tap a photo to start swiping from there
        </ThemedText>
      </View>
      <FlatList
        data={images}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        maxToRenderPerBatch={21}
        windowSize={10}
        initialNumToRender={21}
      />
      <BottomNavBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: BOTTOM_NAV_HEIGHT,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  listContent: {
    padding: GAP,
  },
  row: {
    justifyContent: "flex-start",
    gap: GAP,
  },
  imageContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
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
    borderRadius: 4,
  },
  deletionOverlay: {
    backgroundColor: "rgba(255, 0, 0, 0.4)", // Opaque red
  },
  keepOverlay: {
    backgroundColor: "rgba(76, 175, 80, 0.4)", // Opaque green (Material Design green)
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  title: {
    marginBottom: 16,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
