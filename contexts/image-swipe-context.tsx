import React, { createContext, useContext, useState, ReactNode } from "react";

type ImageSwipeState = {
  markedForDeletion: Set<string>;
  markedForKeep: Set<string>;
  markForDeletion: (imageId: string) => void;
  markForKeep: (imageId: string) => void;
  unmarkForDeletion: (imageId: string) => void;
  unmarkForKeep: (imageId: string) => void;
  clearAll: () => void;
};

const ImageSwipeContext = createContext<ImageSwipeState | undefined>(undefined);

export function ImageSwipeProvider({ children }: { children: ReactNode }) {
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(
    new Set()
  );
  const [markedForKeep, setMarkedForKeep] = useState<Set<string>>(new Set());

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
        markForDeletion,
        markForKeep,
        unmarkForDeletion,
        unmarkForKeep,
        clearAll,
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

