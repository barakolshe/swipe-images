import { SwipeableCard } from "@/components/swipeable-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useImageSwipe } from "@/contexts/image-swipe-context";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ImageAsset = {
  id: string;
  uri: string;
  creationTime: number;
};

export default function HomeScreen() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [history, setHistory] = useState<
    Array<{ index: number; wasLeftSwipe: boolean }>
  >([]);
  const router = useRouter();
  const params = useLocalSearchParams<{ startImageId?: string }>();
  const {
    markedForDeletion,
    markForDeletion,
    markForKeep,
    unmarkForDeletion,
    unmarkForKeep,
    clearAll,
  } = useImageSwipe();

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    // Set starting index if provided from gallery (by image ID)
    if (params.startImageId && images.length > 0) {
      const foundIndex = images.findIndex(
        (img) => img.id === params.startImageId
      );
      if (foundIndex !== -1) {
        setCurrentIndex(foundIndex);
      }
    }
  }, [params.startImageId, images]);

  const requestPermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        loadImages();
      } else {
        Alert.alert(
          "Permission Required",
          "Please grant photo library access to use this app.",
          [{ text: "OK" }]
        );
        setLoading(false);
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      setLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      setLoading(true);
      const albums = await MediaLibrary.getAlbumsAsync();

      // Get all images from all albums
      const allImages: ImageAsset[] = [];

      for (const album of albums) {
        const assets = await MediaLibrary.getAssetsAsync({
          album: album,
          mediaType: MediaLibrary.MediaType.photo,
          first: 1000, // Adjust as needed
        });

        assets.assets.forEach((asset: MediaLibrary.Asset) => {
          allImages.push({
            id: asset.id,
            uri: asset.uri,
            creationTime: asset.creationTime,
          });
        });
      }

      // Also get images not in any album
      const allAssets = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 1000,
      });

      allAssets.assets.forEach((asset: MediaLibrary.Asset) => {
        if (!allImages.find((img) => img.id === asset.id)) {
          allImages.push({
            id: asset.id,
            uri: asset.uri,
            creationTime: asset.creationTime,
          });
        }
      });

      // Sort by creation time (newest first, like phone gallery)
      const sorted = allImages.sort((a, b) => b.creationTime - a.creationTime);
      setImages(sorted);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error loading images:", error);
      Alert.alert("Error", "Failed to load images from your library.");
    } finally {
      setLoading(false);
    }
  };

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

    // Unmark the image based on the last action
    if (previousIndex < images.length) {
      const imageToUnmark = images[previousIndex];
      if (lastAction.wasLeftSwipe) {
        unmarkForDeletion(imageToUnmark.id);
      } else {
        unmarkForKeep(imageToUnmark.id);
      }
    }

    // Go back to previous index
    setCurrentIndex(previousIndex);

    // Remove the last action from history (but keep the rest for further undos)
    setHistory((prev) => prev.slice(0, -1));
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

    try {
      // Delete all marked assets from media library
      await MediaLibrary.deleteAssetsAsync(imageIdsToDelete);

      // Remove from local state
      const newImages = images.filter((img) => !markedSet.has(img.id));
      setImages(newImages);

      // Clear the marked set and undo history
      clearAll();
      setHistory([]);

      // Maintain the current image position
      if (newImages.length === 0) {
        Alert.alert("Done!", "All images have been deleted.");
      } else {
        // Find the current image in the new array
        const newIndex = newImages.findIndex(
          (img) => img.id === currentImageId
        );

        if (newIndex !== -1) {
          // Current image still exists, stay on it
          setCurrentIndex(newIndex);
        } else {
          // Current image was deleted, adjust index to stay at same position
          // Count how many images before currentIndex were deleted
          const deletedBeforeCurrent = images
            .slice(0, currentIndex)
            .filter((img) => markedSet.has(img.id)).length;

          // Calculate new index: currentIndex minus deleted items before it
          const adjustedIndex = Math.max(
            0,
            currentIndex - deletedBeforeCurrent
          );
          // Make sure we don't go out of bounds
          setCurrentIndex(Math.min(adjustedIndex, newImages.length - 1));
        }

        Alert.alert("Success", `Deleted ${imageIdsToDelete.length} image(s).`);
      }
    } catch (error) {
      console.error("Error deleting images:", error);
      Alert.alert("Error", "Failed to delete some images.");
    }
  };

  if (loading) {
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
        {visibleCards.map((image, index) => (
          <SwipeableCard
            key={image.id}
            imageUri={image.uri}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            index={index}
          />
        ))}
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
