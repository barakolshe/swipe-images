import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as MediaLibrary from "expo-media-library";
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
};

const ImageSwipeContext = createContext<ImageSwipeState | undefined>(undefined);

export function ImageSwipeProvider({ children }: { children: ReactNode }) {
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(
    new Set()
  );
  const [markedForKeep, setMarkedForKeep] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const loadImages = async () => {
    try {
      setImagesLoading(true);
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
    setMarkedForDeletion((prev) => new Set(prev).add(imageId));
    // Remove from keep set if it was there
    setMarkedForKeep((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  };

  const markForKeep = (imageId: string) => {
    setMarkedForKeep((prev) => new Set(prev).add(imageId));
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
      return newSet;
    });
  };

  const unmarkForKeep = (imageId: string) => {
    setMarkedForKeep((prev) => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
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

