import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { 
  Parcelle, 
  RGB, 
  LegendItem,
  BoundingBox,
  ConversionOptions 
} from '../types/cadastre.types.js';
import { CoordinateConverterService } from './coordinate-converter.service.js';

export class PDFGeneratorService {
  private coordinateConverter: CoordinateConverterService;
  
  constructor() {
    this.coordinateConverter = new CoordinateConverterService();
  }
  
  async annotatePDF(
    inputPDFPath: string,
    outputPDFPath: string,
    parcelles: Parcelle[],
    options?: { showLegend?: boolean; showStats?: boolean }
  ): Promise<void> {
    let pdfDoc: PDFDocument;
    let isExistingPDF = false;
    
    // Vérifier si le PDF d'entrée existe et est valide
    if (existsSync(inputPDFPath)) {
      try {
        console.log(`📄 Chargement du PDF existant: ${inputPDFPath}`);
        const pdfBytes = await readFile(inputPDFPath);
        pdfDoc = await PDFDocument.load(pdfBytes);
        isExistingPDF = true;
        console.log(`✅ PDF chargé avec succès (${pdfDoc.getPageCount()} page(s))`);
      } catch (error) {
        console.warn(`⚠️ Impossible de charger le PDF existant: ${error}`);
        console.log('📄 Création d\'un nouveau PDF...');
        pdfDoc = await PDFDocument.create();
      }
    } else {
      console.log(`📄 Le fichier ${inputPDFPath} n'existe pas, création d'un nouveau PDF...`);
      pdfDoc = await PDFDocument.create();
    }
    
    let page;
    
    if (pdfDoc.getPageCount() === 0) {
      // Ajouter une page A4 paysage si pas de page
      page = pdfDoc.addPage([842, 595]);
    } else {
      // Utiliser la première page existante
      page = pdfDoc.getPages()[0];
    }
    
    const { width, height } = page.getSize();
    console.log(`📐 Dimensions de la page: ${width} x ${height}`);
    
    // Calculer la bounding box de toutes les parcelles
    const allCoordinates: number[][][] = [];
    
    for (const p of parcelles) {
      if (p.geometry.type === 'Polygon') {
        allCoordinates.push(p.geometry.coordinates[0]);
      } else if (p.geometry.type === 'MultiPolygon') {
        for (const polygon of p.geometry.coordinates) {
          allCoordinates.push(polygon[0]);
        }
      }
    }
    
    const bbox = this.coordinateConverter.calculateBoundingBox(allCoordinates);
    console.log(`🗺️ Bounding box calculée: (${bbox.minX.toFixed(2)}, ${bbox.minY.toFixed(2)}) à (${bbox.maxX.toFixed(2)}, ${bbox.maxY.toFixed(2)})`);
    
    const conversionOptions: ConversionOptions = {
      width,
      height,
      margin: 50,
      bbox
    };
    
    // Si c'est un nouveau PDF, ajouter un fond blanc et un titre
    if (!isExistingPDF) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(1, 1, 1)
      });
      
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      page.drawText('Plan Cadastral', {
        x: 50,
        y: height - 40,
        size: 16,
        font,
        color: rgb(0, 0, 0)
      });
      
      const dateFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const date = new Date().toLocaleDateString('fr-FR');
      page.drawText(`Généré le ${date}`, {
        x: 50,
        y: height - 60,
        size: 10,
        font: dateFont,
        color: rgb(0.3, 0.3, 0.3)
      });
    } else {
      // Ajouter un petit texte en bas à droite pour indiquer l'annotation
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const date = new Date().toLocaleDateString('fr-FR');
      page.drawText(`Annotations ajoutées le ${date}`, {
        x: width - 200,
        y: 20,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
    
    const couleurs: RGB[] = [
      { r: 1, g: 0, b: 0 },      // Rouge
      { r: 0, g: 0, b: 1 },      // Bleu
      { r: 0, g: 1, b: 0 },      // Vert
      { r: 1, g: 0.5, b: 0 },    // Orange
      { r: 0.5, g: 0, b: 0.5 },  // Violet
      { r: 0, g: 1, b: 1 },      // Cyan
    ];
    
    const legendItems: LegendItem[] = [];
    
    console.log(`🎨 Dessin de ${parcelles.length} parcelle(s)...`);
    
    for (let i = 0; i < parcelles.length; i++) {
      const parcelle = parcelles[i];
      const couleur = couleurs[i % couleurs.length];
      
      // Dessiner la parcelle
      if (parcelle.geometry.type === 'Polygon') {
        this.drawPolygon(
          page,
          parcelle.geometry.coordinates[0],
          conversionOptions,
          couleur,
          0.25  // Plus transparent pour mieux voir le plan dessous
        );
      } else if (parcelle.geometry.type === 'MultiPolygon') {
        for (const polygon of parcelle.geometry.coordinates) {
          this.drawPolygon(
            page,
            polygon[0],
            conversionOptions,
            couleur,
            0.25
          );
        }
      }
      
      // Dessiner les bâtiments si présents
      if (parcelle.batiments && parcelle.batiments.length > 0) {
        console.log(`   🏢 ${parcelle.batiments.length} bâtiment(s) pour ${parcelle.id}`);
        for (const batiment of parcelle.batiments) {
          if (batiment.geometry.type === 'Polygon') {
            this.drawPolygon(
              page,
              batiment.geometry.coordinates[0],
              conversionOptions,
              { r: 0.3, g: 0.3, b: 0.3 },
              0.6,
              1.5
            );
          }
        }
      }
      
      // Ajouter à la légende
      const surfaceBatie = parcelle.batiments?.reduce((sum, b) => sum + b.surface, 0) || 0;
      legendItems.push({
        parcelleId: parcelle.id,
        couleur,
        surfaceTotale: parcelle.surface || 0,
        surfaceBatie
      });
    }
    
    if (options?.showLegend) {
      console.log('📚 Ajout de la légende...');
      await this.drawLegend(page, legendItems, pdfDoc);
    }
    
    if (options?.showStats) {
      console.log('📊 Ajout des statistiques...');
      await this.drawStats(page, legendItems, pdfDoc);
    }
    
    const modifiedPdfBytes = await pdfDoc.save();
    await writeFile(outputPDFPath, modifiedPdfBytes);
    console.log(`✅ PDF sauvegardé: ${outputPDFPath}`);
  }
  
  private drawPolygon(
    page: any,
    coordinates: number[][],
    options: ConversionOptions,
    color: RGB,
    opacity: number = 0.5,
    borderWidth: number = 2
  ): void {
    const pdfCoords = this.coordinateConverter.geoToPDF(coordinates, options.bbox, options);
    
    if (pdfCoords.length < 3) return;
    
    const fillColor = rgb(color.r, color.g, color.b);
    
    // Dessiner le contour
    for (let i = 0; i < pdfCoords.length - 1; i++) {
      page.drawLine({
        start: { x: pdfCoords[i].x, y: pdfCoords[i].y },
        end: { x: pdfCoords[i + 1].x, y: pdfCoords[i + 1].y },
        thickness: borderWidth,
        color: fillColor,
        opacity: 1  // Contour opaque
      });
    }
    
    // Fermer le polygone
    page.drawLine({
      start: { x: pdfCoords[pdfCoords.length - 1].x, y: pdfCoords[pdfCoords.length - 1].y },
      end: { x: pdfCoords[0].x, y: pdfCoords[0].y },
      thickness: borderWidth,
      color: fillColor,
      opacity: 1
    });
    
    // Remplissage avec des lignes horizontales
    this.fillPolygonWithLines(page, pdfCoords, fillColor, opacity);
  }
  
  private fillPolygonWithLines(
    page: any,
    points: { x: number; y: number }[],
    color: any,
    opacity: number
  ): void {
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const numLines = 40;  // Plus de lignes pour un meilleur remplissage
    const step = (maxY - minY) / numLines;
    
    for (let y = minY + step/2; y < maxY; y += step) {
      const intersections: number[] = [];
      
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const x = p1.x + (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
          intersections.push(x);
        }
      }
      
      intersections.sort((a, b) => a - b);
      
      for (let i = 0; i < intersections.length - 1; i += 2) {
        if (intersections[i] < intersections[i + 1]) {
          page.drawLine({
            start: { x: intersections[i], y },
            end: { x: intersections[i + 1], y },
            thickness: 1,
            color,
            opacity
          });
        }
      }
    }
  }
  
  private async drawLegend(page: any, items: LegendItem[], pdfDoc: any): Promise<void> {
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const legendX = width - 220;
    let legendY = height - 50;
    
    page.drawRectangle({
      x: legendX - 10,
      y: legendY - items.length * 25 - 20,
      width: 200,
      height: items.length * 25 + 40,
      color: rgb(1, 1, 1),
      opacity: 0.95,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1
    });
    
    page.drawText('Légende', {
      x: legendX,
      y: legendY,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
    
    legendY -= 25;
    
    for (const item of items) {
      page.drawRectangle({
        x: legendX,
        y: legendY - 4,
        width: 14,
        height: 14,
        color: rgb(item.couleur.r, item.couleur.g, item.couleur.b),
        opacity: 0.5,
        borderColor: rgb(item.couleur.r, item.couleur.g, item.couleur.b),
        borderWidth: 1
      });
      
      const displayId = item.parcelleId.length > 15 
        ? item.parcelleId.substring(0, 13) + '...'
        : item.parcelleId;
      
      page.drawText(displayId, {
        x: legendX + 22,
        y: legendY,
        size: 9,
        font,
        color: rgb(0, 0, 0)
      });
      
      legendY -= 22;
    }
  }
  
  private async drawStats(page: any, items: LegendItem[], pdfDoc: any): Promise<void> {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const statsX = 50;
    let statsY = 180;
    
    const boxHeight = items.length * 22 + 60;
    
    page.drawRectangle({
      x: statsX - 10,
      y: statsY - boxHeight + 20,
      width: 400,
      height: boxHeight,
      color: rgb(1, 1, 1),
      opacity: 0.95,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1
    });
    
    page.drawText('Statistiques des parcelles', {
      x: statsX,
      y: statsY,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
    
    statsY -= 25;
    
    page.drawText('Parcelle', { x: statsX, y: statsY, size: 9, font: fontBold });
    page.drawText('Surface totale', { x: statsX + 120, y: statsY, size: 9, font: fontBold });
    page.drawText('Surface bâtie', { x: statsX + 230, y: statsY, size: 9, font: fontBold });
    page.drawText('Occupation', { x: statsX + 330, y: statsY, size: 9, font: fontBold });
    
    statsY -= 18;
    
    page.drawLine({
      start: { x: statsX, y: statsY + 8 },
      end: { x: statsX + 380, y: statsY + 8 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    
    for (const item of items) {
      const occupation = item.surfaceTotale > 0 
        ? ((item.surfaceBatie / item.surfaceTotale) * 100).toFixed(1)
        : '0.0';
      
      const displayId = item.parcelleId.length > 15
        ? item.parcelleId.substring(0, 13) + '..'
        : item.parcelleId;
      
      page.drawText(displayId, { x: statsX, y: statsY, size: 8, font });
      page.drawText(`${Math.round(item.surfaceTotale)} m²`, { x: statsX + 120, y: statsY, size: 8, font });
      page.drawText(`${Math.round(item.surfaceBatie)} m²`, { x: statsX + 230, y: statsY, size: 8, font });
      page.drawText(`${occupation}%`, { x: statsX + 330, y: statsY, size: 8, font });
      
      statsY -= 20;
    }
  }
}