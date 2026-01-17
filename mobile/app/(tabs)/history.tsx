import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/auth/firebase';
import { useAuth } from '../../contexts/AuthContext';

interface GenerationHistory {
  id: string;
  originalImageUrl: string;
  generatedImages: string[];
  aspectRatio: string;
  createdAt: Date;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'generations'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const items: GenerationHistory[] = snapshot.docs.map(doc => ({
        id: doc.id,
        originalImageUrl: doc.data().originalImageUrl || '',
        generatedImages: doc.data().generatedImages || [],
        aspectRatio: doc.data().aspectRatio || '4:5',
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      setHistory(items);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: GenerationHistory }) => (
    <View style={styles.historyItem}>
      <View style={styles.headerRow}>
        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        <Text style={styles.ratioText}>{item.aspectRatio}</Text>
      </View>
      <View style={styles.imagesContainer}>
        {item.generatedImages.slice(0, 4).map((img, index) => (
          <Image
            key={index}
            source={{ uri: img }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={history.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyText}>履歴がありません</Text>
            <Text style={styles.emptySubtext}>画像を生成すると、ここに表示されます</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  ratioText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnail: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
