import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  CustomerInfoUpdateListener,
  PURCHASES_ERROR_CODE,
  PurchasesOffering,
  PurchasesPackage
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// Entitlement identifier for SwipeImages Pro
const PRO_ENTITLEMENT_ID = 'SwipeImages Pro';

// Product identifiers (these should match your RevenueCat dashboard)
const PRODUCT_IDENTIFIERS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  LIFETIME: 'lifetime',
} as const;

type SubscriptionTier = 'pro' | 'none';

interface SubscriptionState {
  currentTier: SubscriptionTier;
  isLoading: boolean;
  isPurchasing: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  availablePackages: PurchasesPackage[];
  // Subscription management
  upgradeToPro: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
  // Paywall
  presentPaywall: () => Promise<boolean>;
  // Customer Center
  presentCustomerCenter: () => Promise<void>;
  // Package getters
  getMonthlyPackage: () => PurchasesPackage | undefined;
  getYearlyPackage: () => PurchasesPackage | undefined;
  getLifetimePackage: () => PurchasesPackage | undefined;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

// RevenueCat API Key - Replace with your actual key
// For production, use environment variables
const REVENUECAT_API_KEY = 
  Platform.OS === 'ios' 
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'test_NBIYBpxrxnMjkAMPSdFigvyWryS'
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'test_NBIYBpxrxnMjkAMPSdFigvyWryS';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PurchasesPackage[]>([]);

  // Initialize RevenueCat
  useEffect(() => {
    initializeRevenueCat();
    
    // Set up customer info update listener
    const updateListener: CustomerInfoUpdateListener = (customerInfo) => {
      setCustomerInfo(customerInfo);
      updateSubscriptionTier(customerInfo);
    };
    
    Purchases.addCustomerInfoUpdateListener(updateListener);
    
    return () => {
      // Cleanup listener if needed
      // Note: react-native-purchases doesn't have removeListener in v9
      // The listener will be cleaned up when component unmounts
    };
  }, []);

  const initializeRevenueCat = async () => {
    try {
      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      // Configure RevenueCat
      // Note: The API key format should be the same for both platforms in test mode
      // In production, you'll have separate iOS and Android keys
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      
      console.log('✅ RevenueCat initialized successfully');
      
      // Fetch initial customer info and offerings
      await refreshSubscriptionStatus();
    } catch (error: any) {
      console.error('❌ Error initializing RevenueCat:', error);
      Alert.alert(
        'Initialization Error', 
        `Failed to initialize subscription service: ${error.message || 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateSubscriptionTier = (info: CustomerInfo) => {
    // Check if user has the Pro entitlement
    const proEntitlement = info.entitlements.active[PRO_ENTITLEMENT_ID];
    
    if (proEntitlement && proEntitlement.isActive) {
      setCurrentTier('pro');
    } else {
      setCurrentTier('none');
    }
  };

  const refreshSubscriptionStatus = async () => {
    try {
      // Fetch customer info and offerings in parallel
      const [customerInfoData, offeringsData] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);

      setCustomerInfo(customerInfoData);
      
      // Get the current offering (default offering)
      const currentOffering = offeringsData.current;
      
      if (currentOffering) {
        setOfferings(currentOffering);
        setAvailablePackages(currentOffering.availablePackages);
      } else {
        console.warn('⚠️ No current offering available');
        setOfferings(null);
        setAvailablePackages([]);
      }

      // Update subscription tier based on entitlements
      updateSubscriptionTier(customerInfoData);
      
      console.log('✅ Subscription status refreshed');
    } catch (error: any) {
      console.error('❌ Error refreshing subscription status:', error);
      // Don't show alert on refresh errors to avoid annoying users
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage) => {
    if (isPurchasing) {
      console.warn('⚠️ Purchase already in progress');
      return;
    }
    
    setIsPurchasing(true);
    try {
      console.log(`🛒 Purchasing package: ${pkg.identifier}`);
      
      // Purchase the package
      const { customerInfo: updatedCustomerInfo } = await Purchases.purchasePackage(pkg);
      
      setCustomerInfo(updatedCustomerInfo);
      updateSubscriptionTier(updatedCustomerInfo);
      
      // Check if Pro entitlement is now active
      const proEntitlement = updatedCustomerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
      
      if (proEntitlement && proEntitlement.isActive) {
        Alert.alert('Success! 🎉', 'You now have access to SwipeImages Pro!');
      } else {
        // Refresh to get latest state
        await refreshSubscriptionStatus();
        Alert.alert('Purchase Complete', 'Your purchase was successful.');
      }
      
    } catch (error: any) {
      console.error('❌ Error purchasing package:', error);
      
      // Handle user cancellation gracefully
      if (
        error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
        error.userCancelled
      ) {
        console.log('ℹ️ User cancelled purchase');
        // Don't show error for user cancellation
        return;
      }
      
      // Handle other errors
      let errorMessage = 'Failed to complete purchase. Please try again.';
      
      if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        errorMessage = 'Your payment is pending. Please complete it and try again.';
      } else if (error.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        errorMessage = 'Purchases are not allowed on this device.';
      } else if (error.code === PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR) {
        errorMessage = 'The purchase is invalid. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Purchase Error', errorMessage);
    } finally {
      setIsPurchasing(false);
    }
  };

  const upgradeToPro = async () => {
    try {
      // Try to present the paywall first
      await presentPaywallForUpgrade();
    } catch (error: any) {
      console.error('❌ Error in upgradeToPro:', error);
      
      // If paywall fails, try to purchase the yearly package as default
      const yearlyPackage = getYearlyPackage();
      if (yearlyPackage) {
        await purchasePackage(yearlyPackage);
      } else {
        Alert.alert('Error', 'No subscription packages available. Please try again later.');
      }
    }
  };

  const presentPaywallForUpgrade = async (): Promise<boolean> => {
    try {
      // Present paywall for current offering (or optionally specify an offering)
      console.log('🔄 Presenting paywall for upgrade');
      const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
      
      // Handle the result
      switch (paywallResult) {
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
          return false;
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          // Refresh subscription status after successful purchase/restore
          await refreshSubscriptionStatus();
          return true;
        default:
          return false;
      }
    } catch (error: any) {
      console.error('❌ Error presenting paywall:', error);
      Alert.alert(
        'Error', 
        error.message || 'Failed to load subscription options. Please try again later.'
      );
      return false;
    }
  };

  const presentCustomerCenter = async () => {
    try {
      // Present RevenueCat Customer Center
      // This allows users to manage their subscriptions, restore purchases, etc.
      await Purchases.presentCodeRedemptionSheet();
      
      // Note: For full customer center, you may need to use a custom implementation
      // or wait for RevenueCat to add full customer center support
      // For now, we'll use the code redemption sheet and restore purchases
      
      // After presenting, refresh the status
      await refreshSubscriptionStatus();
    } catch (error: any) {
      console.error('❌ Error presenting customer center:', error);
      
      // Fallback: Show restore purchases option
      Alert.alert(
        'Manage Subscription',
        'Would you like to restore your purchases?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Restore', 
            onPress: restorePurchases 
          },
        ]
      );
    }
  };

  const restorePurchases = async () => {
    setIsPurchasing(true);
    try {
      console.log('🔄 Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      setCustomerInfo(customerInfo);
      updateSubscriptionTier(customerInfo);
      
      const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
      
      if (proEntitlement && proEntitlement.isActive) {
        Alert.alert('Success! ✅', 'Your purchases have been restored. You now have access to SwipeImages Pro!');
      } else {
        Alert.alert('Restore Complete', 'No active subscriptions found. If you have an active subscription, please contact support.');
      }
    } catch (error: any) {
      console.error('❌ Error restoring purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again or contact support.');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Helper functions to get specific packages
  const getMonthlyPackage = useCallback((): PurchasesPackage | undefined => {
    return availablePackages.find(
      (pkg) => 
        pkg.identifier.toLowerCase().includes(PRODUCT_IDENTIFIERS.MONTHLY) ||
        pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY
    );
  }, [availablePackages]);

  const getYearlyPackage = useCallback((): PurchasesPackage | undefined => {
    return availablePackages.find(
      (pkg) => 
        pkg.identifier.toLowerCase().includes(PRODUCT_IDENTIFIERS.YEARLY) ||
        pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL
    );
  }, [availablePackages]);

  const getLifetimePackage = useCallback((): PurchasesPackage | undefined => {
    return availablePackages.find(
      (pkg) => 
        pkg.identifier.toLowerCase().includes(PRODUCT_IDENTIFIERS.LIFETIME) ||
        pkg.packageType === Purchases.PACKAGE_TYPE.LIFETIME
    );
  }, [availablePackages]);

  return (
    <SubscriptionContext.Provider
      value={{
        currentTier,
        isLoading,
        isPurchasing,
        customerInfo,
        offerings,
        availablePackages,
        upgradeToPro,
        purchasePackage,
        restorePurchases,
        refreshSubscriptionStatus,
        presentPaywall: presentPaywallForUpgrade,
        presentCustomerCenter,
        getMonthlyPackage,
        getYearlyPackage,
        getLifetimePackage,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
