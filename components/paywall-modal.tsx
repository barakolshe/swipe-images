import { useSubscription } from '@/contexts/subscription-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const {
    availablePackages,
    purchasePackage,
    isPurchasing,
    restorePurchases,
    getMonthlyPackage,
    getYearlyPackage,
  } = useSubscription();


  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const monthlyPackage = getMonthlyPackage();
  const yearlyPackage = getYearlyPackage();

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setSelectedPackage(pkg);
    try {
      await purchasePackage(pkg);
      // Close modal on successful purchase
      onClose();
    } catch (error) {
      // Error handling is done in the context
    } finally {
      setSelectedPackage(null);
    }
  };

  const formatPrice = (pkg: PurchasesPackage) => {
    return pkg.product.priceString;
  };

  const getPackageTitle = (pkg: PurchasesPackage) => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('monthly') || pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) {
      return 'Monthly';
    }
    if (identifier.includes('yearly') || identifier.includes('annual') || pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) {
      return 'Yearly';
    }
    if (identifier.includes('lifetime') || pkg.packageType === Purchases.PACKAGE_TYPE.LIFETIME) {
      return 'Lifetime';
    }
    return 'Premium';
  };

  const getPackageDescription = (pkg: PurchasesPackage) => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('monthly') || pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) {
      return 'Billed monthly';
    }
    if (identifier.includes('yearly') || identifier.includes('annual') || pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) {
      return 'Billed annually • Save 17%';
    }
    if (identifier.includes('lifetime') || pkg.packageType === Purchases.PACKAGE_TYPE.LIFETIME) {
      return 'One-time payment';
    }
    return 'Premium access';
  };

  const getPackageIcon = (pkg: PurchasesPackage) => {
    const identifier = pkg.identifier.toLowerCase();
    if (identifier.includes('monthly') || pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY) {
      return 'calendar-alt';
    }
    if (identifier.includes('yearly') || identifier.includes('annual') || pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL) {
      return 'calendar-check';
    }
    if (identifier.includes('lifetime') || pkg.packageType === Purchases.PACKAGE_TYPE.LIFETIME) {
      return 'infinity';
    }
    return 'crown';
  };

  const isRecommended = (pkg: PurchasesPackage) => {
    // Mark yearly as recommended
    return yearlyPackage && pkg.identifier === yearlyPackage.identifier;
  };

  const renderPackageCard = (pkg: PurchasesPackage | undefined, index: number) => {
    if (!pkg) return null;

    const isRecommendedPkg = isRecommended(pkg);
    const isSelected = selectedPackage?.identifier === pkg.identifier;
    const isPurchasingThis = isPurchasing && isSelected;

    return (
      <TouchableOpacity
        key={pkg.identifier}
        style={[
          styles.packageCard,
          isRecommendedPkg && styles.recommendedCard,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => !isPurchasing && handlePurchase(pkg)}
        disabled={isPurchasing}
        activeOpacity={0.7}
      >
        {isRecommendedPkg && (
          <View style={styles.recommendedBadge}>
            <ThemedText style={styles.recommendedBadgeText}>BEST VALUE</ThemedText>
          </View>
        )}
        <View style={styles.packageHeader}>
          <View style={styles.packageIconContainer}>
            <FontAwesome5
              name={getPackageIcon(pkg)}
              size={28}
              color={isRecommendedPkg ? tintColor : textColor}
            />
          </View>
          <View style={styles.packageTitleContainer}>
            <ThemedText style={styles.packageTitle}>{getPackageTitle(pkg)}</ThemedText>
            <ThemedText style={styles.packageDescription}>{getPackageDescription(pkg)}</ThemedText>
          </View>
        </View>
        <View style={styles.packagePriceContainer}>
          <ThemedText style={styles.packagePrice}>{formatPrice(pkg)}</ThemedText>
        </View>
        {isPurchasingThis && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={tintColor} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome5 name="times" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <View style={styles.iconContainer}>
                <FontAwesome5 name="crown" size={48} color={tintColor} />
              </View>
              <ThemedText type="title" style={styles.title}>
                Unlock SwipeImages Pro
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Get unlimited access to all premium features
              </ThemedText>
            </View>

            {/* Features List */}
            <View style={styles.featuresContainer}>
              {[
                'Unliimited deletions',
                'Add-free experience',
                'Priority support',
              ].map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <FontAwesome5
                    name="check-circle"
                    size={20}
                    color={tintColor}
                    style={styles.featureIcon}
                  />
                  <ThemedText style={styles.featureText}>{feature}</ThemedText>
                </View>
              ))}
            </View>

            {/* Package Selection */}
            <View style={styles.packagesContainer}>
              {renderPackageCard(yearlyPackage, 0)}
              {renderPackageCard(monthlyPackage, 1)}
            </View>

            {/* Restore Purchases */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={restorePurchases}
              disabled={isPurchasing}
            >
              <ThemedText style={styles.restoreButtonText}>Restore Purchases</ThemedText>
            </TouchableOpacity>

            {/* Terms */}
            <View style={styles.termsContainer}>
              <ThemedText style={styles.termsText}>
                By continuing, you agree to our Terms of Service and Privacy Policy. Subscriptions
                will auto-renew unless cancelled at least 24 hours before the end of the current
                period.
              </ThemedText>
            </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  featuresContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    flex: 1,
    justifyContent: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  packagesContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  packageCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  recommendedCard: {
    borderColor: '#0a7ea4',
    backgroundColor: 'rgba(10, 126, 164, 0.05)',
  },
  selectedCard: {
    borderColor: '#0a7ea4',
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  packageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  packageTitleContainer: {
    flex: 1,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  packagePriceContainer: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0a7ea4',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  termsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  termsText: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 14,
  },
});
