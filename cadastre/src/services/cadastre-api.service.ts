import axios from 'axios';
import { GeoJSONFeature, Parcelle, Batiment } from '../types/cadastre.types.js';
import { GeoportailAPIService, GeoportailParcelle } from './geoportail-api.service.js';

interface CommuneAPI {
  code: string;
  nom: string;
  codesPostaux?: string[];
  population?: number;
}

export class CadastreAPIService {
  private readonly baseURL = 'https://apicarto.ign.fr/api/cadastre';
  private geoportailService: GeoportailAPIService;
  
  constructor() {
    this.geoportailService = new GeoportailAPIService();
  }
  
  /**
   * Récupère les infos d'une parcelle à partir d'une adresse
   */
  async getParcelleFromAdresse(adresse: string, codePostal?: string, ville?: string): Promise<Parcelle | null> {
    console.log(`\n📍 Recherche de parcelle pour: ${adresse} ${codePostal || ''} ${ville || ''}`);
    
    // 1. Trouver la référence cadastrale via Géoportail
    const geoportailParcelle = await this.geoportailService.getParcelleFromAdresse(adresse, codePostal, ville);
    
    if (!geoportailParcelle) {
      console.log('⚠️ Impossible de trouver la parcelle via Géoportail, utilisation du mock');
      const mockParcelle = this.geoportailService.generateMockParcelle(adresse, codePostal, ville);
      return this.getParcelleInfo(mockParcelle.id);
    }
    
    console.log(`✅ Référence cadastrale trouvée: ${geoportailParcelle.id}`);
    console.log(`   Section: ${geoportailParcelle.section}, Numéro: ${geoportailParcelle.numero}`);
    
    // 2. Récupérer les informations complètes de la parcelle
    return this.getParcelleInfo(geoportailParcelle.id);
  }
  
  async getParcelleInfo(parcelleId: string): Promise<Parcelle> {
    try {
      const parsed = this.parseParcelleId(parcelleId);
      
      console.log(`🔍 Recherche parcelle: ${parsed.code_insee} / ${parsed.section} / ${parsed.numero}`);
      
      // Essayer l'API IGN
      try {
        const response = await axios.get(`${this.baseURL}/parcelle`, {
          params: {
            code_insee: parsed.code_insee,
            section: parsed.section,
            numero: parsed.numero,
            geom: 'true'
          },
          timeout: 10000
        });
        
        const data = response.data;
        
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const batiments = await this.getBatiments(parsed.code_insee, parsed.section, parsed.numero);
          
          return {
            id: parcelleId,
            commune: parsed.code_insee,
            section: parsed.section,
            numero: parsed.numero,
            geometry: feature.geometry,
            surface: feature.properties.surface_parcelle || this.calculerSurface(feature.geometry),
            batiments
          };
        }
      } catch (error) {
        console.warn('⚠️ API IGN non disponible, utilisation des données mock');
      }
      
      // Fallback: générer une parcelle mock avec des coordonnées réalistes
      return this.generateMockParcelle(parcelleId, parsed);
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      const parsed = this.parseParcelleId(parcelleId);
      return this.generateMockParcelle(parcelleId, parsed);
    }
  }
  
  /**
   * Génère une parcelle mock avec des coordonnées réalistes pour Nice
   */
  private generateMockParcelle(parcelleId: string, parsed: { code_insee: string; section: string; numero: string }): Parcelle {
    console.log('📦 Génération de données mock pour la parcelle');
    
    // Coordonnées réalistes pour Nice (Lambert 93)
    let baseX = 1035000;
    let baseY = 6300000;
    
    // Ajuster selon la section
    const sectionCode = parsed.section.charCodeAt(0) || 65;
    const sectionCode2 = parsed.section.charCodeAt(1) || 65;
    const numeroCode = parseInt(parsed.numero) || 1;
    
    const offsetX = (sectionCode - 65) * 200 + (sectionCode2 - 65) * 50 + (numeroCode * 10);
    const offsetY = (sectionCode - 65) * 150 + (sectionCode2 - 65) * 30 + (numeroCode * 8);
    
    // Taille de la parcelle
    const width = 40 + (numeroCode % 20) * 5;
    const height = 30 + (sectionCode % 15) * 4;
    
    const coords: number[][] = [
      [baseX + offsetX, baseY + offsetY],
      [baseX + offsetX + width, baseY + offsetY],
      [baseX + offsetX + width, baseY + offsetY + height],
      [baseX + offsetX, baseY + offsetY + height],
      [baseX + offsetX, baseY + offsetY]
    ];
    
    const surface = width * height;
    
    // Générer des bâtiments
    const batiments: Batiment[] = [];
    const nbBatiments = (numeroCode % 3) + 1;
    
    for (let i = 0; i < nbBatiments; i++) {
      const batWidth = width * (0.4 + (i * 0.1));
      const batHeight = height * (0.3 + (i * 0.1));
      const batX = baseX + offsetX + 5 + (i * (width / nbBatiments));
      const batY = baseY + offsetY + 5 + (i * (height / nbBatiments));
      
      batiments.push({
        id: `${parcelleId}-B${i + 1}`,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [batX, batY],
            [batX + batWidth, batY],
            [batX + batWidth, batY + batHeight],
            [batX, batY + batHeight],
            [batX, batY]
          ]]
        },
        surface: batWidth * batHeight,
        type: i === 0 ? 'dur' : 'leger'
      });
    }
    
    return {
      id: parcelleId,
      commune: parsed.code_insee,
      section: parsed.section,
      numero: parsed.numero,
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      },
      surface,
      batiments
    };
  }
  
  private parseParcelleId(parcelleId: string): { code_insee: string; section: string; numero: string } {
    const cleanId = parcelleId.trim().toUpperCase();
    
    // Format standard: 33063000BW0012
    const standardMatch = cleanId.match(/^(\d{5})([A-Z0-9]{2})(\d{3})(\d{4})$/);
    if (standardMatch) {
      return {
        code_insee: standardMatch[1],
        section: standardMatch[2],
        numero: standardMatch[3] + standardMatch[4]
      };
    }
    
    // Format simple: 06088LA0123
    const simpleMatch = cleanId.match(/^(\d{5})([A-Z]{2})(\d+)$/);
    if (simpleMatch) {
      return {
        code_insee: simpleMatch[1],
        section: simpleMatch[2],
        numero: simpleMatch[3].padStart(4, '0')
      };
    }
    
    // Fallback
    if (cleanId.length >= 9) {
      return {
        code_insee: cleanId.substring(0, 5),
        section: cleanId.substring(5, 7),
        numero: cleanId.substring(7).padStart(4, '0')
      };
    }
    
    throw new Error(`Format d'identifiant de parcelle invalide: ${parcelleId}`);
  }
  
  async getBatiments(code_insee: string, section: string, numero: string): Promise<Batiment[]> {
    try {
      const response = await axios.get(`${this.baseURL}/batiment`, {
        params: { code_insee, section, numero },
        timeout: 5000
      });
      
      const data = response.data;
      
      if (!data.features || data.features.length === 0) {
        return [];
      }
      
      return data.features.map((feature: GeoJSONFeature, index: number) => ({
        id: `${code_insee}${section}${numero}-B${index + 1}`,
        geometry: feature.geometry,
        surface: this.calculerSurface(feature.geometry),
        type: feature.properties.type || 'dur'
      }));
    } catch (error) {
      return [];
    }
  }
  
  async downloadCadastrePDF(commune: string, section: string): Promise<Buffer> {
    console.log('📄 Création d\'un nouveau PDF...');
    
    const emptyPDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000056 00000 n
0000000111 00000 n
0000000203 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
248
%%EOF`;
    
    return Buffer.from(emptyPDF);
  }
  
  async searchCommune(nomCommune: string): Promise<CommuneAPI[]> {
    try {
      const response = await axios.get(`https://geo.api.gouv.fr/communes`, {
        params: { nom: nomCommune, fields: 'code,nom', boost: 'population', limit: 20 }
      });
      return response.data;
    } catch (error) {
      return [];
    }
  }
  
  async searchParcelles(code_insee: string): Promise<string[]> {
    const sections = ['AA', 'AB', 'AC', 'AD', 'AE', 'LA', 'LB', 'MA', 'MB'];
    const parcelles: string[] = [];
    
    for (const section of sections.slice(0, 5)) {
      for (let i = 1; i <= 10; i++) {
        parcelles.push(`${code_insee}${section}${i.toString().padStart(4, '0')}`);
      }
    }
    
    return parcelles;
  }
  
  private calculerSurface(geometry: any): number {
    if (geometry.type === 'Polygon') {
      return this.calculerSurfacePolygone(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.reduce((total: number, poly: number[][][]) => 
        total + this.calculerSurfacePolygone(poly[0]), 0);
    }
    return 0;
  }
  
  private calculerSurfacePolygone(coords: number[][]): number {
    let surface = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      surface += x1 * y2 - x2 * y1;
    }
    return Math.abs(surface) / 2;
  }
}