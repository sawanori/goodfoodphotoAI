import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AspectRatioSelector } from '../../components/AspectRatioSelector';
import { GenerationProgress } from '../../components/GenerationProgress';
import { ImageGrid } from '../../components/ImageGrid';
import { useGeneration } from '../../hooks/useGeneration';
import { AspectRatio } from '../../services/api/generation';
import { useSubscriptionContext } from '../../contexts/SubscriptionContext';
import { UpgradeModal } from '../../components/UpgradeModal';

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const { generating, progress, error, result, startGeneration, reset } = useGeneration();
  const { status, refresh } = useSubscriptionContext();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('エラー', 'カメラロールへのアクセスが必要です');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      setSelectedImageBase64(result.assets[0].base64);
      reset();
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('エラー', 'カメラへのアクセスが必要です');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      setSelectedImageBase64(result.assets[0].base64);
      reset();
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !selectedImageBase64) {
      Alert.alert('エラー', '画像を選択してください');
      return;
    }

    if (!status || status.remaining <= 0) {
      setUpgradeModalVisible(true);
      return;
    }

    try {
      await startGeneration(selectedImageBase64, aspectRatio);
      await refresh();
    } catch (err: any) {
      console.error('Generation error:', err);
      if (err.message && err.message.includes('QUOTA_EXCEEDED')) {
        setUpgradeModalVisible(true);
      } else {
        Alert.alert('エラー', '画像生成に失敗しました');
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>料理を撮影</Text>

        {status && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionText}>
              残り生成回数: {status.remaining} / {status.limit}
            </Text>
            <Text style={styles.tierText}>
              プラン: {status.tier === 'free' ? '無料' : status.tier === 'starter' ? 'スターター' : 'プロ'}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Text style={styles.actionButtonText}>📷 カメラで撮影</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Text style={styles.actionButtonText}>🖼️ ギャラリーから選択</Text>
          </TouchableOpacity>
        </View>

        {selectedImage && (
          <View style={styles.previewContainer}>
            <Text style={styles.sectionTitle}>選択した画像</Text>
            <Image source={{ uri: selectedImage }} style={styles.preview} />
          </View>
        )}

        {selectedImage && !generating && !result && (
          <>
            <AspectRatioSelector selected={aspectRatio} onSelect={setAspectRatio} />

            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
              <Text style={styles.generateButtonText}>画像を生成</Text>
            </TouchableOpacity>
          </>
        )}

        {generating && <GenerationProgress progress={progress} />}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reset}>
              <Text style={styles.retryButtonText}>もう一度試す</Text>
            </TouchableOpacity>
          </View>
        )}

        {result && result.images && (
          <View style={styles.resultContainer}>
            <Text style={styles.sectionTitle}>生成された画像</Text>
            <ImageGrid images={result.images} />
            <TouchableOpacity style={styles.resetButton} onPress={reset}>
              <Text style={styles.resetButtonText}>新しい画像を生成</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <UpgradeModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
      />
    </ScrollView>
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
    marginBottom: 16,
  },
  subscriptionInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  subscriptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  tierText: {
    fontSize: 12,
    color: '#0C4A6E',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  previewContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  generateButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFCCCC',
  },
  errorText: {
    color: '#CC0000',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 24,
  },
  resetButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resetButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
