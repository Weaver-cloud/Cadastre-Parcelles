import proj4 from 'proj4';
import { BoundingBox, PDFCoordinate, ConversionOptions } from '../types/cadastre.types.js';

export class CoordinateConverterService {
  private readonly lambert93Projection: string;
  private readonly wgs84Projection: string;
  
  constructor() {
    this.lambert93Projection = '+proj=lcc +lat_1=44 +lat_2=49 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
    this.wgs84Projection = 'EPSG:4326';
  }
  
  lambert93ToWGS84(x: number, y: number): [number, number] {
    return proj4(this.lambert93Projection, this.wgs84Projection, [x, y]);
  }
  
  wgs84ToLambert93(lon: number, lat: number): [number, number] {
    return proj4(this.wgs84Projection, this.lambert93Projection, [lon, lat]);
  }
  
  geoToPDF(
    coordinates: number[][],
    _bbox: BoundingBox,
    options: ConversionOptions
  ): PDFCoordinate[] {
    const { width, height, margin, bbox: targetBBox } = options;
    
    const scaleX = (width - 2 * margin) / (targetBBox.maxX - targetBBox.minX);
    const scaleY = (height - 2 * margin) / (targetBBox.maxY - targetBBox.minY);
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = (width - (targetBBox.maxX - targetBBox.minX) * scale) / 2;
    const offsetY = (height - (targetBBox.maxY - targetBBox.minY) * scale) / 2;
    
    return coordinates.map(([x, y]) => ({
      x: (x - targetBBox.minX) * scale + offsetX,
      y: height - ((y - targetBBox.minY) * scale + offsetY)
    }));
  }
  
  calculateBoundingBox(coordinatesList: number[][][]): BoundingBox {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const coords of coordinatesList) {
      for (const [x, y] of coords) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    
    // Si aucune coordonnée n'a été traitée
    if (minX === Infinity) {
      return {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100
      };
    }
    
    const marginX = (maxX - minX) * 0.1;
    const marginY = (maxY - minY) * 0.1;
    
    return {
      minX: minX - marginX,
      minY: minY - marginY,
      maxX: maxX + marginX,
      maxY: maxY + marginY
    };
  }
}