import 'package:flutter/material.dart';

class LowStockWidget extends StatelessWidget {
  final List<Map<String, dynamic>> lowStockItems;

  const LowStockWidget({Key? key, required this.lowStockItems}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (lowStockItems.isEmpty)
           Padding(
             padding: const EdgeInsets.symmetric(vertical: 20),
             child: Text("Tout est bon!", style: TextStyle(color: Colors.greenAccent.withOpacity(0.8), fontWeight: FontWeight.bold)),
           ),
           
        ...lowStockItems.take(5).map((item) {
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: Colors.redAccent.withOpacity(0.1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.orangeAccent.withOpacity(0.8), size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          item['name'],
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Text(
                        "${item['current_stock']}",
                        style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      Text(
                        " / ${item['min_stock']}",
                        style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
        
        if (lowStockItems.length > 5)
          Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: Text(
              "+ ${lowStockItems.length - 5} autres produits en alerte",
              style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12, fontStyle: FontStyle.italic),
            ),
          ),
      ],
    );
  }
}
