import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";

export type ImageAsset = {
  id: string;
  uri: string;
  creationTime: number;
};

type ImageSwipeState = {
  markedForDeletion: Set<string>;
  markedForKeep: Set<string>;
  images: ImageAsset[];
  imagesLoading: boolean;
  permissionGranted: boolean;
  markForDeletion: (imageId: string) => void;
  markForKeep: (imageId: string) => void;
  unmarkForDeletion: (imageId: string) => void;
  unmarkForKeep: (imageId: string) => void;
  clearAll: () => void;
  refreshImages: () => Promise<void>;
  removeFromPersistedKeep: (imageIds: string[]) => Promise<void>;
  removeFromPersistedDeletion: (imageIds: string[]) => Promise<void>;
  saveLastViewedImage: (imageId: string) => Promise<void>;
  loadLastViewedImage: () => Promise<string | null>;
};

const ImageSwipeContext = createContext<ImageSwipeState | undefined>(undefined);

const KEPT_IMAGES_STORAGE_KEY = "@swipe:kept_images";
const DELETION_IMAGES_STORAGE_KEY = "@swipe:deletion_images";
const LAST_VIEWED_IMAGE_KEY = "@swipe:last_viewed_image";

export function ImageSwipeProvider({ children }: { children: ReactNode }) {
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(
    new Set()
  );
  const [markedForKeep, setMarkedForKeep] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Load persisted kept images from storage
  const loadPersistedKeptImages = async (): Promise<Set<string>> => {
    try {
      const stored = await AsyncStorage.getItem(KEPT_IMAGES_STORAGE_KEY);
      if (stored) {
        const keptIds = JSON.parse(stored) as string[];
        return new Set(keptIds);
      }
    } catch (error) {
      console.error("Error loading persisted kept images:", error);
    }
    return new Set<string>();
  };

  // Load persisted deletion images from storage
  const loadPersistedDeletionImages = async (): Promise<Set<string>> => {
    try {
      const stored = await AsyncStorage.getItem(DELETION_IMAGES_STORAGE_KEY);
      if (stored) {
        const deletionIds = JSON.parse(stored) as string[];
        return new Set(deletionIds);
      }
    } catch (error) {
      console.error("Error loading persisted deletion images:", error);
    }
    return new Set<string>();
  };

  // Save kept images to storage
  const savePersistedKeptImages = async (keptIds: Set<string>) => {
    try {
      const idsArray = Array.from(keptIds);
      await AsyncStorage.setItem(
        KEPT_IMAGES_STORAGE_KEY,
        JSON.stringify(idsArray)
      );
    } catch (error) {
      console.error("Error saving persisted kept images:", error);
    }
  };

  // Save deletion images to storage
  const savePersistedDeletionImages = async (deletionIds: Set<string>) => {
    try {
      const idsArray = Array.from(deletionIds);
      await AsyncStorage.setItem(
        DELETION_IMAGES_STORAGE_KEY,
        JSON.stringify(idsArray)
      );
    } catch (error) {
      console.error("Error saving persisted deletion images:", error);
    }
  };

  // Remove images from persisted storage
  const removeFromPersistedKeep = async (imageIds: string[]) => {
    try {
      const currentKept = await loadPersistedKeptImages();
      imageIds.forEach((id) => currentKept.delete(id));
      await savePersistedKeptImages(currentKept);
    } catch (error) {
      console.error("Error removing from persisted keep:", error);
    }
  };

  // Remove images from persisted deletion storage
  const removeFromPersistedDeletion = async (imageIds: string[]) => {
    try {
      const currentDeletion = await loadPersistedDeletionImages();
      imageIds.forEach((id) => currentDeletion.delete(id));
      await savePersistedDeletionImages(currentDeletion);
    } catch (error) {
      console.error("Error removing from persisted deletion:", error);
    }
  };

  // Save last viewed image ID
  const saveLastViewedImage = async (imageId: string) => {
    try {
      await AsyncStorage.setItem(LAST_VIEWED_IMAGE_KEY, imageId);
    } catch (error) {
      console.error("Error saving last viewed image:", error);
    }
  };

  // Load last viewed image ID
  const loadLastViewedImage = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(LAST_VIEWED_IMAGE_KEY);
    } catch (error) {
      console.error("Error loading last viewed image:", error);
      return null;
    }
  };

  const loadImages = async () => {
    try {
      setImagesLoading(true);
      // Load persisted kept and deletion images
      const persistedKept = await loadPersistedKeptImages();
      const persistedDeletion = await loadPersistedDeletionImages();
      // Restore persisted choices to the state
      setMarkedForKeep(persistedKept);
      setMarkedForDeletion(persistedDeletion);

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

      // Don't filter - show all images with their persisted choices
      // Sort by creation time (newest first, like phone gallery)
      const sorted = allImages.sort((a, b) => b.creationTime - a.creationTime);
      setImages(sorted);
    } catch (error) {
      console.error("Error loading images:", error);
      Alert.alert("Error", "Failed to load images from your library.");
    } finally {
      setImagesLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        await loadImages();
      } else {
        setPermissionGranted(false);
        setImagesLoading(false);
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      setImagesLoading(false);
    }
  };

  // Load images on app startup
  useEffect(() => {
    requestPermissions();
  }, []);

  const refreshImages = async () => {
    if (permissionGranted) {
      await loadImages();
    }
  };

  const markForDeletion = (imageId: string) => {
    setMarkedForDeletion((prev) => {
      const newSet = new Set(prev).add(imageId);
      // Save to persistent storage
      savePersistedDeletionImages(newSet);
      return newSet;
    });
    // Remove from keep set if it was there
    setMarkedForKeep((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      // Update persistent storage
      savePersistedKeptImages(newSet);
      return newSet;
    });
  };

  const markForKeep = (imageId: string) => {
    setMarkedForKeep((prev) => {
      const newSet = new Set(prev).add(imageId);
      // Save to persistent storage
      savePersistedKeptImages(newSet);
      return newSet;
    });
    // Remove from deletion set if it was there
    setMarkedForDeletion((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  };

  const unmarkForDeletion = (imageId: string) => {
    setMarkedForDeletion((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      // Update persistent storage
      savePersistedDeletionImages(newSet);
      return newSet;
    });
  };

  const unmarkForKeep = (imageId: string) => {
    setMarkedForKeep((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      // Update persistent storage
      savePersistedKeptImages(newSet);
      return newSet;
    });
  };

  const clearAll = () => {
    setMarkedForDeletion(new Set());
    setMarkedForKeep(new Set());
  };

  return (
    <ImageSwipeContext.Provider
      value={{
        markedForDeletion,
        markedForKeep,
        images,
        imagesLoading,
        permissionGranted,
        markForDeletion,
        markForKeep,
        unmarkForDeletion,
        unmarkForKeep,
        clearAll,
        refreshImages,
        removeFromPersistedKeep,
        removeFromPersistedDeletion,
        saveLastViewedImage,
        loadLastViewedImage,
      }}
    >
      {children}
    </ImageSwipeContext.Provider>
  );
}

export function useImageSwipe() {
  const context = useContext(ImageSwipeContext);
  if (context === undefined) {
    throw new Error("useImageSwipe must be used within an ImageSwipeProvider");
  }
  return context;
}
