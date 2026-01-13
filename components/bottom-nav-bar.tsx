import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useRouter, useSegments } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./themed-text";

export function BottomNavBar() {
  const router = useRouter();
  const segments = useSegments();
  // Get the last segment, or "index" if segments is empty (meaning we're on the root)
  const currentSegment = segments.length > 0 ? segments[segments.length - 1] : "index";

  const isActive = (path: string) => {
    // Remove leading slash and get the segment name
    const pathSegment = path === "/" ? "index" : path.replace(/^\//, "");
    return currentSegment === pathSegment;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isActive("/") && styles.activeButton]}
        onPress={() => router.push("/")}
      >
        <FontAwesome5
          name="images"
          size={20}
          color={isActive("/") ? "#4CAF50" : "#666"}
        />
        <ThemedText
          style={[
            styles.buttonText,
            isActive("/") && styles.activeButtonText,
          ]}
        >
          Swipe
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive("/gallery") && styles.activeButton]}
        onPress={() => router.push("/gallery")}
      >
        <FontAwesome5
          name="th"
          size={20}
          color={isActive("/gallery") ? "#4CAF50" : "#666"}
        />
        <ThemedText
          style={[
            styles.buttonText,
            isActive("/gallery") && styles.activeButtonText,
          ]}
        >
          Gallery
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive("/account") && styles.activeButton]}
        onPress={() => router.push("/account")}
      >
        <FontAwesome5
          name="user"
          size={20}
          color={isActive("/account") ? "#4CAF50" : "#666"}
        />
        <ThemedText
          style={[
            styles.buttonText,
            isActive("/account") && styles.activeButtonText,
          ]}
        >
          Account
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingBottom: 15,
    paddingTop: 9,
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  activeButton: {
    // Additional styling for active button if needed
  },
  buttonText: {
    fontSize: 11,
    marginTop: 2,
    color: "#666",
  },
  activeButtonText: {
    color: "#4CAF50",
    fontWeight: "600",
  },
});
