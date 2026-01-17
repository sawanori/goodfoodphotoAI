import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSubscriptionContext } from '../contexts/SubscriptionContext';

interface SubscriptionCardProps {
  onUpgradePress?: () => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ onUpgradePress }) => {
  const { status, loading } = useSubscriptionContext();

  if (loading || !status) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  const isFree = status.tier === 'free';
  const planName = status.tier === 'starter' ? 'スタータープラン' : '無料プラン';
  const tierColor = isFree ? '#999' : '#FF6B35';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.planName, { color: tierColor }]}>{planName}</Text>
          <Text style={styles.statusText}>
            {status.status === 'active' ? '有効' : '期限切れ'}
          </Text>
        </View>
        {isFree && onUpgradePress && (
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
            <Text style={styles.upgradeButtonText}>アップグレード</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.usageSection}>
        <View style={styles.usageRow}>
          <Text style={styles.usageLabel}>今月の残り回数</Text>
          <Text style={styles.usageValue}>
            <Text style={styles.remainingCount}>{status.remaining}</Text>
            <Text style={styles.totalCount}> / {status.limit}</Text>
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(100, ((status.limit - status.remaining) / status.limit) * 100))}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.usedText}>
          使用済み: {status.used}回
        </Text>
      </View>

      {status.renewsAt && (
        <View style={styles.renewSection}>
          <Text style={styles.renewText}>
            次回更新日: {new Date(status.renewsAt).toLocaleDateString('ja-JP')}
          </Text>
        </View>
      )}

      {status.addOns.length > 0 && (
        <View style={styles.addOnsSection}>
          <Text style={styles.addOnsTitle}>追加パック</Text>
          {status.addOns.map((addOn, index) => (
            <Text key={index} style={styles.addOnText}>
              {addOn.type}: +{addOn.amount}回
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  upgradeButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 16,
  },
  usageSection: {
    marginBottom: 16,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageLabel: {
    fontSize: 16,
    color: '#333',
  },
  usageValue: {
    fontSize: 16,
  },
  remainingCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  totalCount: {
    fontSize: 16,
    color: '#999',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  usedText: {
    fontSize: 12,
    color: '#999',
  },
  renewSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  renewText: {
    fontSize: 14,
    color: '#666',
  },
  addOnsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addOnsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  addOnText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
