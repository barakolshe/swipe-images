import { SwipeableCard } from "@/components/swipeable-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import * as MediaLibrary from "expo-media-library";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ImageAsset = {
  id: string;
  uri: string;
};

export default function HomeScreen() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

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
          });
        }
      });

      // Shuffle images for variety
      const shuffled = allImages.sort(() => Math.random() - 0.5);
      setImages(shuffled);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Error loading images:", error);
      Alert.alert("Error", "Failed to load images from your library.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwipeLeft = async () => {
    if (currentIndex >= images.length) return;

    const imageToDelete = images[currentIndex];

    try {
      // Delete the asset from media library
      await MediaLibrary.deleteAssetsAsync([imageToDelete.id]);

      // Remove from local state
      const newImages = images.filter((img) => img.id !== imageToDelete.id);
      setImages(newImages);

      // Don't increment index since we removed an item
      if (newImages.length === 0) {
        Alert.alert("Done!", "All images have been reviewed.");
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      Alert.alert("Error", "Failed to delete the image.");
      // Still move to next image even if deletion failed
      setCurrentIndex((prev) => Math.min(prev + 1, images.length - 1));
    }
  };

  const handleSwipeRight = () => {
    // Just move to next image (keep the image)
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= images.length) {
        Alert.alert("Done!", "All images have been reviewed.");
        return prev;
      }
      return next;
    });
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
        <ThemedText style={styles.infoText}>
          {currentIndex + 1} / {images.length}
        </ThemedText>
        <ThemedText style={styles.instructionText}>
          Swipe left to delete • Swipe right to keep
        </ThemedText>
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
});
