export interface Parcelle {
  id: string;
  commune: string;
  section: string;
  numero: string;
  geometry: GeoJSONPolygon | GeoJSONMultiPolygon;
  surface?: number;
  batiments?: Batiment[];
}

export interface Batiment {
  id: string;
  geometry: GeoJSONPolygon | GeoJSONMultiPolygon;
  surface: number;
  type: 'dur' | 'leger';
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];  // [exterior ring, ...interior rings]
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];  // Array of polygons
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONPolygon | GeoJSONMultiPolygon;
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface CadastreAPIResponse {
  features: GeoJSONFeature[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PDFCoordinate {
  x: number;
  y: number;
}

export interface ParcelleStats {
  parcelleId: string;
  surfaceTotale: number;
  surfaceBatie: number;
  surfaceNonBatie: number;
  pourcentageOccupation: number;
  couleur: RGB;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface LegendItem {
  parcelleId: string;
  couleur: RGB;
  surfaceTotale: number;
  surfaceBatie: number;
}

export interface ConversionOptions {
  width: number;
  height: number;
  margin: number;
  bbox: BoundingBox;
}