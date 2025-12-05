import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useImageSwipe } from "@/contexts/image-swipe-context";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type ImageAsset = {
  id: string;
  uri: string;
  creationTime: number;
};

export default function GalleryScreen() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const router = useRouter();
  const { markedForDeletion, markedForKeep } = useImageSwipe();

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
    } catch (error) {
      console.error("Error loading images:", error);
      Alert.alert("Error", "Failed to load images from your library.");
    } finally {
      setLoading(false);
    }
  };

  const handleImagePress = (imageId: string) => {
    router.push({
      pathname: "/",
      params: { startImageId: imageId },
    });
  };

  const renderItem = ({ item }: { item: ImageAsset }) => {
    const isMarkedForDeletion = markedForDeletion.has(item.id);
    const isMarkedForKeep = markedForKeep.has(item.id);

    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => handleImagePress(item.id)}
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
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
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
