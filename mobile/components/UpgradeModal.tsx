import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSubscriptionContext } from '../contexts/SubscriptionContext';
import { purchaseManager, Product } from '../services/iap/purchaseManager';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ visible, onClose }) => {
  const { purchaseSubscription } = useSubscriptionContext();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchingProducts, setFetchingProducts] = useState(true);

  useEffect(() => {
    if (visible) {
      loadProducts();
    }
  }, [visible]);

  const loadProducts = async () => {
    try {
      setFetchingProducts(true);
      const productList = await purchaseManager.getProducts();
      setProducts(productList);
    } catch (error) {
      console.error('Failed to load products:', error);
      Alert.alert('エラー', '商品情報の取得に失敗しました');
    } finally {
      setFetchingProducts(false);
    }
  };

  const handlePurchase = async () => {
    try {
      setLoading(true);
      const result = await purchaseSubscription();

      if (result.success) {
        Alert.alert(
          '購入完了',
          'スタータープランへのアップグレードが完了しました!',
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert('エラー', result.error || '購入処理に失敗しました');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('エラー', '購入処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>スタータープランにアップグレード</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {fetchingProducts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B35" />
              </View>
            ) : (
              <>
                <View style={styles.priceSection}>
                  <Text style={styles.price}>¥1,980</Text>
                  <Text style={styles.priceSubtext}>/ 月</Text>
                </View>

                <View style={styles.featuresSection}>
                  <Text style={styles.sectionTitle}>プランに含まれる特典</Text>

                  <View style={styles.feature}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>月間50回の生成</Text>
                      <Text style={styles.featureDescription}>
                        毎月50回まで画像生成が可能
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feature}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>高画質出力</Text>
                      <Text style={styles.featureDescription}>
                        より高品質な画像を生成できます
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feature}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>優先処理</Text>
                      <Text style={styles.featureDescription}>
                        生成待ち時間が短縮されます
                      </Text>
                    </View>
                  </View>

                  <View style={styles.feature}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>商用利用可能</Text>
                      <Text style={styles.featureDescription}>
                        生成した画像を商用目的で使用できます
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.notesSection}>
                  <Text style={styles.noteText}>
                    • サブスクリプションは自動更新されます
                  </Text>
                  <Text style={styles.noteText}>
                    • いつでもキャンセル可能です
                  </Text>
                  <Text style={styles.noteText}>
                    • 未使用分の残り回数は翌月に繰り越されません
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.purchaseButton, loading && styles.purchaseButtonDisabled]}
              onPress={handlePurchase}
              disabled={loading || fetchingProducts}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.purchaseButtonText}>
                  月額¥1,980で購読する
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 32,
  },
  price: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  priceSubtext: {
    fontSize: 18,
    color: '#999',
    marginLeft: 8,
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 20,
    color: '#FF6B35',
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  notesSection: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  purchaseButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#ccc',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
  },
});
