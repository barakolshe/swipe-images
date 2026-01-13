import { BottomNavBar } from "@/components/bottom-nav-bar";
import { SwipeableCard } from "@/components/swipeable-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useImageSwipe } from "@/contexts/image-swipe-context";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function HomeScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<
    Array<{ index: number; wasLeftSwipe: boolean }>
  >([]);
  const [undoAnimationTrigger, setUndoAnimationTrigger] = useState(0);
  const [undoAnimationInfo, setUndoAnimationInfo] = useState<{
    imageIndex: number;
    wasLeftSwipe: boolean;
  } | null>(null);
  const [programmaticSwipeTrigger, setProgrammaticSwipeTrigger] = useState(0);
  const [programmaticSwipeDirection, setProgrammaticSwipeDirection] = useState<
    "left" | "right" | null
  >(null);
  const [programmaticSwipeImageId, setProgrammaticSwipeImageId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const initialPositionLoadedRef = useRef(false);
  const isUndoingRef = useRef(false);
  const targetImageIdAfterDeletionRef = useRef<string | null>(null);
  const imagesHash = useRef<string>("");
  const router = useRouter();
  const params = useLocalSearchParams<{ startImageId?: string }>();
  const {
    markedForDeletion,
    markForDeletion,
    markForKeep, 
    unmarkForDeletion,
    unmarkForKeep,
    clearAll,
    clearDeletion,
    images,
    imagesLoading,
    permissionGranted,
    refreshImages,
    removeFromPersistedKeep,
    removeFromPersistedDeletion,
    saveLastViewedImage,
    loadLastViewedImage,
  } = useImageSwipe();

  // Load initial position only once when images are first loaded
  useEffect(() => {
    if (
      imagesLoading ||
      initialPositionLoadedRef.current ||
      images.length === 0 ||
      isUndoingRef.current
    ) {
      return;
    }

    // Set starting index if provided from gallery (by image ID)
    if (params.startImageId) {
      const foundIndex = images.findIndex(
        (img) => img.id === params.startImageId
      );
      if (foundIndex !== -1) {
        setCurrentIndex(foundIndex);
      }
      initialPositionLoadedRef.current = true;
      return;
    }

    // Load last viewed image if no startImageId is provided (only once)
    loadLastViewedImage().then((lastImageId) => {
      // Double-check flag in case component unmounted or state changed
      if (
        lastImageId &&
        images.length > 0 &&
        !initialPositionLoadedRef.current &&
        !isUndoingRef.current
      ) {
        const foundIndex = images.findIndex((img) => img.id === lastImageId);
        if (foundIndex !== -1) {
          setCurrentIndex(foundIndex);
        }
      }
      initialPositionLoadedRef.current = true;
    });
  }, [imagesLoading, images.length, params.startImageId, loadLastViewedImage]);

  // Restore position after deletion completes
  useEffect(() => {
    if (
      isDeleting &&
      !imagesLoading &&
      images.length > 0 &&
      imagesHash.current !== JSON.stringify(images)
    ) {
      if (targetImageIdAfterDeletionRef.current) {
        const targetImageId = targetImageIdAfterDeletionRef.current;
        const newIndex = images.findIndex((img) => img.id === targetImageId);

        if (newIndex !== -1) {
          setCurrentIndex(newIndex);
          saveLastViewedImage(targetImageId);
        } else {
          // Target image not found, use first available image
          setCurrentIndex(0);
          if (images[0]) {
            saveLastViewedImage(images[0].id);
          }
        }
      } else {
        // No target image (all were deleted), stay at index 0
        setCurrentIndex(0);
      }

      // Update history indices to match new image positions
      setHistory((prevHistory) =>
        prevHistory
          .map((entry) => {
            // Find the image that was at this entry's index before deletion
            // We need to track this differently - for now, just keep entries that might still be valid
            // This is a simplified approach - in a more complex scenario, we'd need to track image IDs in history
            return entry;
          })
          .filter((entry) => entry.index < images.length)
      );

      // Reset deletion state
      setIsDeleting(false);
      targetImageIdAfterDeletionRef.current = null;
    } else if (isDeleting && !imagesLoading && images.length === 0) {
      // All images deleted
      setCurrentIndex(0);
      setIsDeleting(false);
      targetImageIdAfterDeletionRef.current = null;
    }
  }, [isDeleting, imagesLoading, images, saveLastViewedImage]);

  // Save current image ID whenever index changes (but only after initial load and not during undo)
  useEffect(() => {
    if (
      !initialPositionLoadedRef.current ||
      images.length === 0 ||
      currentIndex >= images.length ||
      isUndoingRef.current ||
      isDeleting
    ) {
      return;
    }
    const currentImage = images[currentIndex];
    if (currentImage) {
      saveLastViewedImage(currentImage.id);
    }
  }, [currentIndex, images, saveLastViewedImage, isDeleting]);

  const handleSwipeLeft = () => {
    if (isUndoingRef.current) return;
    if (currentIndex >= images.length) return;

    const imageToMark = images[currentIndex];
    const currentIdx = currentIndex;

    // Save current index to history for undo
    setHistory((prev) => [...prev, { index: currentIdx, wasLeftSwipe: true }]);

    // Mark image for deletion instead of deleting immediately
    markForDeletion(imageToMark.id);

    // Move to next image
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= images.length) {
        Alert.alert("Done!", "All images have been reviewed.");
        return prev;
      }
      return next;
    });
  };

  const handleSwipeRight = () => {
    if (isUndoingRef.current) return;
    if (currentIndex >= images.length) return;

    const imageToMark = images[currentIndex];
    const currentIdx = currentIndex;

    // Save current index to history for undo
    setHistory((prev) => [...prev, { index: currentIdx, wasLeftSwipe: false }]);

    // Mark image for keep
    markForKeep(imageToMark.id);

    // Move to next image
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= images.length) {
        Alert.alert("Done!", "All images have been reviewed.");
        return prev;
      }
      return next;
    });
  };

  const handleButtonSwipeLeft = () => {
    if (isUndoingRef.current) return;
    if (currentIndex >= images.length) return;
    
    const currentImage = images[currentIndex];
    if (!currentImage) return;
    
    // Trigger the animation for this specific image
    setProgrammaticSwipeImageId(currentImage.id);
    setProgrammaticSwipeDirection("left");
    setProgrammaticSwipeTrigger((prev) => prev + 1);
    
    // Reset after animation completes
    setTimeout(() => {
      setProgrammaticSwipeDirection(null);
      setProgrammaticSwipeImageId(null);
    }, 500);
  };

  const handleButtonSwipeRight = () => {
    if (isUndoingRef.current) return;
    if (currentIndex >= images.length) return;
    
    const currentImage = images[currentIndex];
    if (!currentImage) return;
    
    // Trigger the animation for this specific image
    setProgrammaticSwipeImageId(currentImage.id);
    setProgrammaticSwipeDirection("right");
    setProgrammaticSwipeTrigger((prev) => prev + 1);
    
    // Reset after animation completes
    setTimeout(() => {
      setProgrammaticSwipeDirection(null);
      setProgrammaticSwipeImageId(null);
    }, 500);
  };

  const handleUndo = () => {
    if (history.length === 0) {
      Alert.alert("Nothing to undo", "You haven't swiped any images yet.");
      return;
    }

    // Prevent multiple undos from running simultaneously
    if (isUndoingRef.current) {
      return;
    }

    // Get the last action from history
    const lastAction = history[history.length - 1];
    const previousIndex = lastAction.index;

    // Validate the index
    if (previousIndex >= images.length || previousIndex < 0) {
      // Index no longer valid, just remove from history
      setHistory((prev) => prev.slice(0, -1));
      return;
    }

    // Get the image to unmark
    const imageToUnmark = images[previousIndex];
    
    // Unmark the image based on the swipe direction
    if (lastAction.wasLeftSwipe) {
      // Left swipe = marked for deletion, so unmark from deletion
      unmarkForDeletion(imageToUnmark.id);
    } else {
      // Right swipe = marked for keep, so unmark from keep
      unmarkForKeep(imageToUnmark.id);
    }

    // Set flag to prevent save effect and other operations from running during undo
    isUndoingRef.current = true;

    // Store undo animation info before changing index
    setUndoAnimationInfo({
      imageIndex: previousIndex,
      wasLeftSwipe: lastAction.wasLeftSwipe,
    });

    // Remove the last action from history first (before changing index)
    setHistory((prev) => prev.slice(0, -1));

    // Go back to previous index (but don't unmark the image)
    // Use a function to ensure we're using the correct value
    setCurrentIndex(previousIndex);

    // Trigger animation after React has rendered the new card
    // Use a small timeout to ensure the card is in the DOM
    setTimeout(() => {
      setUndoAnimationTrigger((prev) => prev + 1);
    }, 50);

    // Clear undo animation info and reset flag after animation completes
    setTimeout(() => {
      setUndoAnimationInfo(null);
      // Save the position after undo is complete
      if (images[previousIndex]) {
        saveLastViewedImage(images[previousIndex].id);
      }
      // Reset flag after everything is done
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 100);
    }, 400);
  };

  const handleCommitDeletion = async () => {
    imagesHash.current = JSON.stringify(images);
    if (markedForDeletion.size === 0) {
      Alert.alert("No Images", "No images are marked for deletion.");
      return;
    }

    const imageIdsToDelete = Array.from(markedForDeletion);

    // Save the current image ID to restore position after deletion
    const currentImageId = images[currentIndex]?.id;
    const markedSet = new Set(markedForDeletion);
    const oldImages = [...images]; // Keep a copy of current images for calculations

    // Check if current image is being deleted
    const isCurrentImageDeleted =
      currentImageId && markedSet.has(currentImageId);

    try {
      // Set deletion flag and target image ID before starting deletion
      setIsDeleting(true);

      // If current image is not being deleted, we'll try to find it after refresh
      // If it is being deleted, we'll find the next available image
      if (!isCurrentImageDeleted && currentImageId) {
        targetImageIdAfterDeletionRef.current = currentImageId;
      } else {
        // Current image is being deleted, find the next non-deleted image
        let nextIndex = currentIndex + 1;
        while (
          nextIndex < oldImages.length &&
          markedSet.has(oldImages[nextIndex].id)
        ) {
          nextIndex++;
        }
        if (nextIndex < oldImages.length) {
          targetImageIdAfterDeletionRef.current = oldImages[nextIndex].id;
        } else {
          // All images after current are deleted, find previous non-deleted image
          let prevIndex = currentIndex - 1;
          while (prevIndex >= 0 && markedSet.has(oldImages[prevIndex].id)) {
            prevIndex--;
          }
          if (prevIndex >= 0) {
            targetImageIdAfterDeletionRef.current = oldImages[prevIndex].id;
          } else {
            // All images are being deleted
            targetImageIdAfterDeletionRef.current = null;
          }
        }
      }

      // Delete all marked assets from media library
      await MediaLibrary.deleteAssetsAsync(imageIdsToDelete);

      // Remove deleted images from persisted storage (both keep and deletion)
      await removeFromPersistedKeep(imageIdsToDelete);
      await removeFromPersistedDeletion(imageIdsToDelete);

      // Refresh images from context to get updated list
      await refreshImages();

      // Clear the marked set and reset history
      clearDeletion();
      
      // Reset undo history when deleting
      setHistory([]);

      // Check if all images were deleted
      const remainingCount = oldImages.filter(
        (img) => !markedSet.has(img.id)
      ).length;
      if (remainingCount === 0) {
        Alert.alert("Done!", "All images have been deleted.");
        setIsDeleting(false);
        targetImageIdAfterDeletionRef.current = null;
        setCurrentIndex(0);
      } else {
        Alert.alert("Success", `Deleted ${imageIdsToDelete.length} image(s).`);
        // Position will be restored by the useEffect when images finish loading
      }
    } catch (error) {
      console.error("Error deleting images:", error);
      Alert.alert("Error", "Failed to delete some images.");
      setIsDeleting(false);
      targetImageIdAfterDeletionRef.current = null;
    }
  };

  if (imagesLoading) {
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

  const visibleCards = images.slice(currentIndex, currentIndex + 3);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.cardsContainer}>
        {visibleCards.map((image, index) => {
          // Check if this is the card that should animate back (the one we're undoing to)
          // Only animate the top card (index 0) to prevent multiple animations
          const shouldAnimateUndo =
            undoAnimationInfo &&
            index === 0 &&
            currentIndex === undoAnimationInfo.imageIndex;

          return (
            <SwipeableCard
              key={image.id}
              imageUri={image.uri}
              imageId={image.id}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              index={index}
              undoAnimation={
                shouldAnimateUndo
                  ? {
                      trigger: undoAnimationTrigger,
                      wasLeftSwipe: undoAnimationInfo.wasLeftSwipe,
                    }
                  : null
              }
              programmaticSwipe={
                programmaticSwipeDirection && programmaticSwipeImageId === image.id
                  ? {
                      trigger: programmaticSwipeTrigger,
                      isLeft: programmaticSwipeDirection === "left",
                      imageId: programmaticSwipeImageId,
                    }
                  : null
              }
            />
          );
        })}
      </View>
      <View style={styles.bottomButtonsContainer}>
        <View style={styles.buttonSection}>
          {history.length > 0 && (
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <FontAwesome5 name="undo" size={32} color="#000" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={handleButtonSwipeLeft}
          >
            <FontAwesome5 name="times" size={40} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.buttonSection} />
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleButtonSwipeRight}
          >
            <FontAwesome5 name="heart" size={40} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.buttonSection}>
          {markedForDeletion.size > 0 && (
            <TouchableOpacity
              style={styles.deleteIconButton}
              onPress={handleCommitDeletion}
            >
              <FontAwesome5 name="trash" size={32} color="#fff" />
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>
                  {markedForDeletion.size}
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <BottomNavBar />
    </ThemedView>
  );
}

const BOTTOM_NAV_HEIGHT = 77; // Height of bottom navigation bar

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: BOTTOM_NAV_HEIGHT,
  },
  cardsContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SCREEN_HEIGHT * 0.02 + BOTTOM_NAV_HEIGHT,
  },
  infoText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    opacity: 0.7,
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
  deleteIconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#ff4444",
  },
  badgeText: {
    color: "#ff4444",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomButtonsContainer: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.04 + BOTTOM_NAV_HEIGHT,
    width: SCREEN_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    zIndex: 1000,
  },
  buttonSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  undoButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFC107",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rejectButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  likeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
