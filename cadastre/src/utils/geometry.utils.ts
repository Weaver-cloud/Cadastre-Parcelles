import { BoundingBox } from '../types/cadastre.types.js';

export class GeometryUtils {
  static calculatePolygonArea(coordinates: number[][]): number {
    let area = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [x1, y1] = coordinates[i];
      const [x2, y2] = coordinates[i + 1];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
  }
  
  static mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
    return {
      minX: Math.min(...boxes.map(b => b.minX)),
      minY: Math.min(...boxes.map(b => b.minY)),
      maxX: Math.max(...boxes.map(b => b.maxX)),
      maxY: Math.max(...boxes.map(b => b.maxY))
    };
  }
  
  static pointInPolygon(point: [number, number], polygon: number[][]): boolean {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
  
  static calculateIntersection(poly1: number[][], poly2: number[][]): number {
    // Calcul simplifié de l'intersection
    // Dans une implémentation réelle, utiliser une bibliothèque comme turf.js
    let intersectionArea = 0;
    
    // Échantillonnage de points pour estimer l'intersection
    const samples = 1000;
    const bbox = this.calculateBoundingBox([...poly1, ...poly2]);
    
    let pointsInside = 0;
    for (let i = 0; i < samples; i++) {
      const x = bbox.minX + Math.random() * (bbox.maxX - bbox.minX);
      const y = bbox.minY + Math.random() * (bbox.maxY - bbox.minY);
      
      if (this.pointInPolygon([x, y], poly1) && this.pointInPolygon([x, y], poly2)) {
        pointsInside++;
      }
    }
    
    const bboxArea = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    intersectionArea = (pointsInside / samples) * bboxArea;
    
    return intersectionArea;
  }
  
  static calculateBoundingBox(coordinates: number[][]): BoundingBox {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    coordinates.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    
    return { minX, minY, maxX, maxY };
  }
  
  static expandBoundingBox(bbox: BoundingBox, factor: number = 0.1): BoundingBox {
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    
    return {
      minX: bbox.minX - width * factor,
      minY: bbox.minY - height * factor,
      maxX: bbox.maxX + width * factor,
      maxY: bbox.maxY + height * factor
    };
  }
}