import { describe, it, expect } from 'vitest';
import { GeometryUtils } from '../src/utils/geometry.utils.js';

describe('GeometryUtils', () => {
  it('should calculate polygon area correctly', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const area = GeometryUtils.calculatePolygonArea(square);
    expect(area).toBe(100);
  });
  
  it('should detect point in polygon', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(GeometryUtils.pointInPolygon([5, 5], square)).toBe(true);
    expect(GeometryUtils.pointInPolygon([15, 15], square)).toBe(false);
  });
  
  it('should merge bounding boxes', () => {
    const box1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const box2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    const merged = GeometryUtils.mergeBoundingBoxes([box1, box2]);
    
    expect(merged.minX).toBe(0);
    expect(merged.maxX).toBe(15);
    expect(merged.minY).toBe(0);
    expect(merged.maxY).toBe(15);
  });
});