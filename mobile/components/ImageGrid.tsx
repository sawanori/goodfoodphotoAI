import React from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Alert, Text } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Paths, File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface ImageGridProps {
  images: string[];
  onImagePress?: (index: number) => void;
}

const { width } = Dimensions.get('window');
const imageSize = (width - 48) / 2; // 2 columns with padding

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onImagePress }) => {
  const saveImageToGallery = async (imageUri: string): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('権限エラー', 'カメラロールへのアクセス許可が必要です');
        return false;
      }

      if (imageUri.startsWith('data:')) {
        const base64Data = imageUri.split(',')[1];
        const file = new File(Paths.document, `generated_${Date.now()}.png`);
        await file.write(base64Data);
        await MediaLibrary.saveToLibraryAsync(file.uri);
        await file.delete();
      } else {
        await MediaLibrary.saveToLibraryAsync(imageUri);
      }
      Alert.alert('保存完了', '画像を保存しました');
      return true;
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('保存エラー', '画像の保存に失敗しました');
      return false;
    }
  };

  const saveAllImages = async () => {
    let successCount = 0;
    for (const img of images) {
      const success = await saveImageToGallery(img);
      if (success) successCount++;
    }
    if (successCount > 0) {
      Alert.alert('保存完了', `${successCount}枚の画像を保存しました`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {images.map((imageUrl, index) => (
          <View key={index} style={styles.imageContainer}>
            <TouchableOpacity
              style={styles.imageWrapper}
              onPress={() => onImagePress?.(index)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: imageUrl }} style={styles.image} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => saveImageToGallery(imageUrl)}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {images.length > 0 && (
        <TouchableOpacity style={styles.saveAllButton} onPress={saveAllImages}>
          <Ionicons name="download" size={20} color="#FFFFFF" style={styles.saveAllIcon} />
          <Text style={styles.saveAllText}>すべて保存</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageContainer: {
    width: imageSize,
    height: imageSize,
    position: 'relative',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  saveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  saveAllIcon: {
    marginRight: 8,
  },
  saveAllText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
