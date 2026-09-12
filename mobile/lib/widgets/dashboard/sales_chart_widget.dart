import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

class SalesChartWidget extends StatelessWidget {
  final List<Map<String, dynamic>> weeklySales;

  const SalesChartWidget({Key? key, required this.weeklySales}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // 1. Determine Max Y for scale
    double maxY = 0;
    for (var item in weeklySales) {
      final total = (item['total'] as num).toDouble();
      if (total > maxY) maxY = total;
    }
    if (maxY == 0) maxY = 100; // prevent 0 scale
    maxY = maxY * 1.2; // Add some padding

    return Container(
      height: 250,
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: BarChart(
              BarChartData(
                maxY: maxY,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    tooltipBgColor: Colors.indigo.withOpacity(0.8),
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      return BarTooltipItem(
                        "${weeklySales[group.x.toInt()]['total']} DZD", 
                        const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (double value, TitleMeta meta) {
                        int index = value.toInt();
                        if (index >= 0 && index < weeklySales.length) {
                           return Padding(
                             padding: const EdgeInsets.only(top: 8.0),
                             child: Text(
                               weeklySales[index]['date'],
                               style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 10),
                             ),
                           );
                        }
                        return const Text('');
                      },
                    ),
                  ),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                barGroups: weeklySales.asMap().entries.map((entry) {
                  int index = entry.key;
                  double value = (entry.value['total'] as num).toDouble();
                  return BarChartGroupData(
                    x: index,
                    barRods: [
                      BarChartRodData(
                        toY: value,
                        gradient: LinearGradient(
                          colors: [Colors.white.withOpacity(0.8), Colors.white.withOpacity(0.3)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        width: 14,
                        borderRadius: BorderRadius.circular(4),
                        backDrawRodData: BackgroundBarChartRodData(
                          show: true,
                          toY: maxY,
                          color: Colors.white.withOpacity(0.05),
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
