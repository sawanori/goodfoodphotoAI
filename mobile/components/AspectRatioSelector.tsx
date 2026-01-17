import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AspectRatio } from '../services/api/generation';

interface AspectRatioSelectorProps {
  selected: AspectRatio;
  onSelect: (ratio: AspectRatio) => void;
}

const ratioOptions: { value: AspectRatio; label: string }[] = [
  { value: '4:5', label: '4:5 (Instagram投稿)' },
  { value: '9:16', label: '9:16 (ストーリー)' },
  { value: '16:9', label: '16:9 (横長)' },
  { value: '1:1', label: '1:1 (正方形)' },
];

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>アスペクト比を選択</Text>
      <View style={styles.optionsContainer}>
        {ratioOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              selected === option.value && styles.optionSelected,
            ]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.optionText,
                selected === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  optionSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF5F2',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  optionTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
});
