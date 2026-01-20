import { BottomNavBar } from "@/components/bottom-nav-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSubscription } from "@/contexts/subscription-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

const BOTTOM_NAV_HEIGHT = 77; // Height of bottom navigation bar

export default function AccountScreen() {
  const { showPaywall } = useSubscription();

  const handleSubscriptionsPress = () => {
    showPaywall();
  };

  const menuItems = [
    {
      id: "subscriptions",
      title: "Subscriptions",
      icon: "crown",
      onPress: handleSubscriptionsPress,
    },
    // Add more menu items here in the future
    // {
    //   id: "settings",
    //   title: "Settings",
    //   icon: "cog",
    //   onPress: () => {},
    // },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Account Management
          </ThemedText>

          <View style={styles.menuContainer}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuButton}
                onPress={item.onPress}
              >
                <View style={styles.menuButtonContent}>
                  <FontAwesome5
                    name={item.icon as any}
                    size={24}
                    color="#0a7ea4"
                    style={styles.menuIcon}
                  />
                  <ThemedText style={styles.menuButtonText}>{item.title}</ThemedText>
                </View>
                <FontAwesome5 name="chevron-right" size={16} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  menuContainer: {
    gap: 12,
  },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  menuButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuButtonText: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
});
