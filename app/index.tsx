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
  const initialPositionLoadedRef = useRef(false);
  const router = useRouter();
  const params = useLocalSearchParams<{ startImageId?: string }>();
  const {
    markedForDeletion,
    markForDeletion,
    markForKeep,
    unmarkForDeletion,
    unmarkForKeep,
    clearAll,
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
      images.length === 0
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
        !initialPositionLoadedRef.current
      ) {
        const foundIndex = images.findIndex((img) => img.id === lastImageId);
        if (foundIndex !== -1) {
          setCurrentIndex(foundIndex);
        }
      }
      initialPositionLoadedRef.current = true;
    });
  }, [imagesLoading, images.length, params.startImageId, loadLastViewedImage]);

  // Save current image ID whenever index changes (but only after initial load)
  useEffect(() => {
    if (
      !initialPositionLoadedRef.current ||
      images.length === 0 ||
      currentIndex >= images.length
    ) {
      return;
    }
    const currentImage = images[currentIndex];
    if (currentImage) {
      saveLastViewedImage(currentImage.id);
    }
  }, [currentIndex, images, saveLastViewedImage]);

  const handleSwipeLeft = () => {
    if (currentIndex >= images.length) return;

    const imageToMark = images[currentIndex];

    // Save current index to history for undo
    setHistory((prev) => [
      ...prev,
      { index: currentIndex, wasLeftSwipe: true },
    ]);

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
    if (currentIndex >= images.length) return;

    const imageToMark = images[currentIndex];

    // Save current index to history for undo
    setHistory((prev) => [
      ...prev,
      { index: currentIndex, wasLeftSwipe: false },
    ]);

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

  const handleUndo = () => {
    if (history.length === 0) {
      Alert.alert("Nothing to undo", "You haven't swiped any images yet.");
      return;
    }

    // Get the last action from history
    const lastAction = history[history.length - 1];
    const previousIndex = lastAction.index;

    // Store undo animation info before changing index
    setUndoAnimationInfo({
      imageIndex: previousIndex,
      wasLeftSwipe: lastAction.wasLeftSwipe,
    });

    // Go back to previous index
    setCurrentIndex(previousIndex);

    // Remove the last action from history (but keep the rest for further undos)
    setHistory((prev) => prev.slice(0, -1));

    // Trigger animation after React has rendered the new card
    // Use a small timeout to ensure the card is in the DOM
    setTimeout(() => {
      setUndoAnimationTrigger((prev) => prev + 1);
    }, 50);

    // Clear undo animation info after animation completes
    setTimeout(() => {
      setUndoAnimationInfo(null);
    }, 400);
  };

  const handleCommitDeletion = async () => {
    if (markedForDeletion.size === 0) {
      Alert.alert("No Images", "No images are marked for deletion.");
      return;
    }

    const imageIdsToDelete = Array.from(markedForDeletion);

    // Save the current image ID and marked set to maintain position after deletion
    const currentImageId = images[currentIndex]?.id;
    const markedSet = new Set(markedForDeletion);
    const oldImages = [...images]; // Keep a copy of current images for calculations
    const oldHistory = [...history]; // Keep a copy of history to preserve it

    try {
      // Delete all marked assets from media library
      await MediaLibrary.deleteAssetsAsync(imageIdsToDelete);

      // Remove deleted images from persisted storage (both keep and deletion)
      await removeFromPersistedKeep(imageIdsToDelete);
      await removeFromPersistedDeletion(imageIdsToDelete);

      // Refresh images from context to get updated list
      await refreshImages();

      // Clear the marked set but preserve history
      clearAll();

      // Wait for context to update, then adjust index and history
      setTimeout(() => {
        // Filter history to remove entries for deleted images and adjust indices
        const updatedHistory = oldHistory
          .map((entry) => {
            // Get the image that was at this entry's index in the old images array
            const imageAtEntry = oldImages[entry.index];
            // If the image at this entry was deleted, return null to filter it out
            if (!imageAtEntry || markedSet.has(imageAtEntry.id)) {
              return null;
            }
            // Find the new index of this image in the updated images list
            const newIndex = images.findIndex(
              (img) => img.id === imageAtEntry.id
            );
            // If image not found in new list, filter it out
            if (newIndex === -1) return null;
            // Return entry with updated index
            return {
              ...entry,
              index: newIndex,
            };
          })
          .filter(
            (entry): entry is { index: number; wasLeftSwipe: boolean } =>
              entry !== null
          );

        // Update history with filtered and adjusted entries
        setHistory(updatedHistory);

        // Calculate how many images before currentIndex were deleted
        const deletedBeforeCurrent = oldImages
          .slice(0, currentIndex)
          .filter((img) => markedSet.has(img.id)).length;

        // Calculate new index: currentIndex minus deleted items before it
        const adjustedIndex = Math.max(0, currentIndex - deletedBeforeCurrent);

        // Make sure we don't go out of bounds (images will be updated from context)
        const newImagesCount = images.filter(
          (img) => !markedSet.has(img.id)
        ).length;
        if (newImagesCount === 0) {
          Alert.alert("Done!", "All images have been deleted.");
          setCurrentIndex(0);
        } else {
          // Find the current image in the updated list
          const newIndex = images.findIndex((img) => img.id === currentImageId);
          if (newIndex !== -1) {
            setCurrentIndex(newIndex);
          } else {
            setCurrentIndex(Math.min(adjustedIndex, newImagesCount - 1));
          }
          Alert.alert(
            "Success",
            `Deleted ${imageIdsToDelete.length} image(s).`
          );
        }
      }, 100);
    } catch (error) {
      console.error("Error deleting images:", error);
      Alert.alert("Error", "Failed to delete some images.");
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
      {history.length > 0 && (
        <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
          <View>
            <FontAwesome5 name="undo" size={32} color="#4CAF50" />
          </View>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.galleryButton}
        onPress={() => router.push("/gallery")}
      >
        <ThemedText style={styles.galleryButtonText}>📷 Gallery</ThemedText>
      </TouchableOpacity>
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
            />
          );
        })}
      </View>
      <View style={styles.infoContainer}>
        <ThemedText style={styles.instructionText}>
          Swipe left to mark for deletion • Swipe right to keep
        </ThemedText>
        {markedForDeletion.size > 0 && (
          <ThemedText style={styles.markedCountText}>
            {markedForDeletion.size} image(s) marked for deletion
          </ThemedText>
        )}
        {markedForDeletion.size > 0 && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleCommitDeletion}
          >
            <ThemedText style={styles.deleteButtonText}>
              Delete {markedForDeletion.size} Image(s)
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  cardsContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
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
  galleryButton: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  galleryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  markedCountText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 8,
    color: "#ff4444",
  },
  deleteButton: {
    marginTop: 16,
    backgroundColor: "#ff4444",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 200,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  undoButton: {
    position: "absolute",
    top: 60,
    left: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 12,
    borderRadius: 25,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  undoIconContainer: {
    transform: [{ rotate: "180deg" }],
  },
});
