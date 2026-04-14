import axios from 'axios';

export interface GeoportailParcelle {
  id: string;
  commune: string;
  section: string;
  numero: string;
  adresse?: string;
  surface?: number;
}

export class GeoportailAPIService {
  private readonly geocodeURL = 'https://api-adresse.data.gouv.fr/search';
  private readonly geoportailURL = 'https://data.geopf.fr/geocodage';
  
  /**
   * Récupère la référence cadastrale à partir d'une adresse
   */
  async getParcelleFromAdresse(adresse: string, codePostal?: string, ville?: string): Promise<GeoportailParcelle | null> {
    try {
      console.log(`🔍 Recherche de l'adresse: ${adresse} ${codePostal || ''} ${ville || ''}`);
      
      // 1. Géocoder l'adresse pour obtenir les coordonnées
      const query = `${adresse} ${codePostal || ''} ${ville || ''}`.trim();
      const geocodeResponse = await axios.get(this.geocodeURL, {
        params: {
          q: query,
          limit: 1
        }
      });
      
      if (!geocodeResponse.data.features || geocodeResponse.data.features.length === 0) {
        console.error('❌ Adresse non trouvée');
        return null;
      }
      
      const feature = geocodeResponse.data.features[0];
      const [lon, lat] = feature.geometry.coordinates;
      const properties = feature.properties;
      
      console.log(`📍 Coordonnées trouvées: ${lat}, ${lon}`);
      console.log(`📌 Adresse: ${properties.label}`);
      console.log(`🏢 Commune: ${properties.city} (${properties.citycode})`);
      
      // 2. Utiliser l'API Géoportail pour trouver la parcelle à ces coordonnées
      const parcelle = await this.getParcelleFromCoordinates(lon, lat);
      
      if (parcelle) {
        parcelle.adresse = properties.label;
        return parcelle;
      }
      
      // 3. Fallback: Essayer avec l'API IGN cadastre
      return await this.getParcelleFromIGN(lon, lat, properties.citycode);
      
    } catch (error) {
      console.error('❌ Erreur lors de la recherche:', error);
      return null;
    }
  }
  
  /**
   * Récupère la parcelle à partir de coordonnées via l'API Géoportail
   */
  private async getParcelleFromCoordinates(lon: number, lat: number): Promise<GeoportailParcelle | null> {
    try {
      // API de géocodage inverse du Géoportail
      const response = await axios.get(`${this.geoportailURL}/reverse`, {
        params: {
          lat,
          lon,
          limit: 1,
          type: 'cadastral_parcel'
        }
      });
      
      if (response.data.features && response.data.features.length > 0) {
        const parcelle = response.data.features[0];
        const props = parcelle.properties;
        
        return {
          id: props.id,
          commune: props.citycode || props.commune,
          section: props.section,
          numero: props.numero,
          surface: props.surface
        };
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ API Géoportail non disponible, utilisation du fallback IGN');
      return null;
    }
  }
  
  /**
   * Fallback: Utilise l'API IGN pour trouver la parcelle
   */
  private async getParcelleFromIGN(lon: number, lat: number, citycode: string): Promise<GeoportailParcelle | null> {
    try {
      // Convertir en Lambert 93 pour l'API IGN
      const proj4 = (await import('proj4')).default;
      
      const wgs84 = 'EPSG:4326';
      const lambert93 = '+proj=lcc +lat_1=44 +lat_2=49 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
      
      const [x, y] = proj4(wgs84, lambert93, [lon, lat]);
      
      console.log(`🗺️ Coordonnées Lambert 93: X=${x.toFixed(2)}, Y=${y.toFixed(2)}`);
      
      // Chercher les parcelles autour de ce point
      const bbox = `${x-100},${y-100},${x+100},${y+100}`;
      
      const response = await axios.get('https://apicarto.ign.fr/api/cadastre/parcelles', {
        params: {
          bbox,
          code_insee: citycode
        },
        timeout: 5000
      });
      
      if (response.data.features && response.data.features.length > 0) {
        // Prendre la première parcelle trouvée
        const parcelle = response.data.features[0];
        const props = parcelle.properties;
        
        // Extraire section et numéro de l'ID
        const id = props.id || '';
        const section = id.substring(5, 7) || 'AA';
        const numero = id.substring(7) || '0001';
        
        return {
          id,
          commune: citycode,
          section,
          numero,
          surface: props.surface_parcelle
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ API IGN non disponible:', error);
      return null;
    }
  }
  
  /**
   * Génère une parcelle mock basée sur l'adresse (fallback ultime)
   */
  generateMockParcelle(adresse: string, codePostal?: string, ville?: string): GeoportailParcelle {
    console.log('📦 Génération d\'une parcelle mock pour démonstration');
    
    // Extraire le numéro de rue pour le seed
    const numeroRue = adresse.match(/^\d+/)?.[0] || '37';
    const seed = parseInt(numeroRue);
    
    // Code INSEE de Nice
    const citycode = codePostal === '06000' ? '06088' : '33063';
    
    // Générer section et numéro basés sur l'adresse
    const sectionCode = String.fromCharCode(65 + (seed % 26)) + String.fromCharCode(65 + ((seed * 2) % 26));
    const numero = seed.toString().padStart(4, '0');
    
    return {
      id: `${citycode}${sectionCode}${numero}`,
      commune: citycode,
      section: sectionCode,
      numero,
      adresse: `${adresse} ${codePostal} ${ville}`.trim(),
      surface: 5000 + (seed * 100)
    };
  }
}