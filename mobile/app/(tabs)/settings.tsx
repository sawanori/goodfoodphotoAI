import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionCard } from '../../components/SubscriptionCard';
import { UpgradeModal } from '../../components/UpgradeModal';
import { useSubscriptionContext } from '../../contexts/SubscriptionContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { status, loading: subLoading, restorePurchases } = useSubscriptionContext();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  const handleRestorePurchases = async () => {
    try {
      setRestoringPurchases(true);
      const result = await restorePurchases();

      if (result.success) {
        Alert.alert(
          '復元完了',
          result.count && result.count > 0
            ? `${result.count}件の購入を復元しました`
            : '復元できる購入はありませんでした'
        );
      } else {
        Alert.alert('エラー', result.error || '購入の復元に失敗しました');
      }
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : '購入の復元中にエラーが発生しました'
      );
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('ログアウト', 'ログアウトしますか?', [
      {
        text: 'キャンセル',
        style: 'cancel',
      },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert(
              'エラー',
              error instanceof Error ? error.message : 'ログアウトに失敗しました'
            );
          }
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>設定</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アカウント情報</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>メールアドレス</Text>
              <Text style={styles.value}>{user?.email || '未設定'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>サブスクリプション</Text>
            {subLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B35" />
              </View>
            ) : (
              <>
                <SubscriptionCard
                  onUpgradePress={() => setUpgradeModalVisible(true)}
                />

                {status?.tier === 'free' && (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => setUpgradeModalVisible(true)}
                  >
                    <Text style={styles.upgradeButtonText}>プランをアップグレード</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={handleRestorePurchases}
                  disabled={restoringPurchases}
                >
                  {restoringPurchases ? (
                    <ActivityIndicator color="#FF6B35" />
                  ) : (
                    <Text style={styles.restoreButtonText}>購入の復元</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アプリについて</Text>
            <View style={styles.infoCard}>
              <Text style={styles.label}>バージョン</Text>
              <Text style={styles.value}>1.0.0</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <UpgradeModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
    marginTop: 24,
  },
  logoutButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  upgradeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
    marginTop: 12,
  },
  restoreButtonText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
});
