import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Platform } from 'react-native';
import { BarChart as RNBarChart, LineChart as RNLineChart } from 'react-native-chart-kit';
import { useTheme } from '../theme/ThemeContext';

interface ChartDatum {
  labels: string[];
  values: number[];
}

function useChartWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };
  return [width, onLayout];
}

export const ThemedBarChart: React.FC<{ data: ChartDatum; suffix?: string; prefix?: string; color?: string }> = ({
  data,
  suffix,
  prefix,
  color,
}) => {
  const { colors } = useTheme();
  const [width, onLayout] = useChartWidth();
  const barColor = color || colors.primary;

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    color: () => barColor,
    labelColor: () => colors.mutedForeground,
    barPercentage: 0.6,
    fillShadowGradient: barColor,
    fillShadowGradientOpacity: 1,
    decimalPlaces: 0,
    propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '4 4' },
    propsForLabels: { fontSize: 10 },
  };

  return (
    <View onLayout={onLayout} style={styles.chartWrap}>
      {width > 10 && Platform.OS !== 'web' ? (
        <RNBarChart
          data={{ labels: data.labels, datasets: [{ data: data.values }] }}
          width={width}
          height={200}
          fromZero
          yAxisLabel={prefix || ''}
          yAxisSuffix={suffix || ''}
          chartConfig={chartConfig as any}
          showValuesOnTopOfBars={false}
          style={{ borderRadius: 12 }}
        />
      ) : (
        <BarFallback data={data} color={barColor} suffix={suffix} prefix={prefix} />
      )}
    </View>
  );
};

export const ThemedLineChart: React.FC<{ data: ChartDatum; color?: string }> = ({ data, color }) => {
  const { colors } = useTheme();
  const [width, onLayout] = useChartWidth();
  const lineColor = color || colors.success;

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    color: () => lineColor,
    labelColor: () => colors.mutedForeground,
    decimalPlaces: 0,
    propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '4 4' },
    propsForLabels: { fontSize: 10 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: colors.card },
  };

  return (
    <View onLayout={onLayout} style={styles.chartWrap}>
      {width > 10 && Platform.OS !== 'web' ? (
        <RNLineChart
          data={{ labels: data.labels, datasets: [{ data: data.values }] }}
          width={width}
          height={200}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={chartConfig as any}
          bezier
          style={{ borderRadius: 12 }}
        />
      ) : (
        <LineFallback data={data} color={lineColor} />
      )}
    </View>
  );
};

const BarFallback: React.FC<{ data: ChartDatum; color: string; suffix?: string; prefix?: string }> = ({ data, color, suffix, prefix }) => {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160, paddingTop: 10 }}>
      {data.labels.map((label, i) => {
        const h = Math.max(6, (data.values[i] / max) * 140);
        return (
          <View key={label + i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 9, fontWeight: '700' }}>
              {prefix || ''}{Math.round(data.values[i])}{suffix || ''}
            </Text>
            <View style={{ width: '70%', height: h, borderRadius: 6, backgroundColor: color }} />
            <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 9, maxWidth: '100%' }}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const LineFallback: React.FC<{ data: ChartDatum; color: string }> = ({ data, color }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, paddingTop: 10 }}>
      {data.labels.map((label, i) => (
        <View key={label + i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 9, fontWeight: '700' }}>{Math.round(data.values[i])}%</Text>
          <View style={{ width: 6, height: Math.max(6, (data.values[i] / 100) * 80), borderRadius: 3, backgroundColor: color }} />
          <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 9 }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  chartWrap: { flex: 1, minHeight: 200, justifyContent: 'center' },
});