import { PDFGeneratorService } from './services/pdf-generator.service.js';
import { CadastreAPIService } from './services/cadastre-api.service.js';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import chalk from 'chalk';

interface Level1Options {
  pdfPath: string;
  parcelleId?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  outputPath?: string;
}

export async function level1(options: Level1Options): Promise<void> {
  const { pdfPath, parcelleId, adresse, codePostal, ville, outputPath } = options;
  
  console.log(chalk.blue.bold('\n🎯 Level 1: Annotation de plan cadastral\n'));
  console.log(chalk.gray(`📄 PDF source: ${pdfPath}`));
  
  // Créer le dossier output si nécessaire
  const outputDir = dirname(outputPath || 'output/temp.pdf');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const apiService = new CadastreAPIService();
  let parcelle;
  
  if (adresse) {
    console.log(chalk.yellow(`\n🔍 Recherche par adresse: ${adresse} ${codePostal || ''} ${ville || ''}`));
    const result = await apiService.getParcelleFromAdresse(adresse, codePostal, ville);
    
    if (!result) {
      throw new Error(`Impossible de trouver la parcelle pour l'adresse: ${adresse}`);
    }
    parcelle = result;
  } else if (parcelleId) {
    console.log(chalk.yellow(`\n🔍 Recherche par ID: ${parcelleId}`));
    parcelle = await apiService.getParcelleInfo(parcelleId);
  } else {
    throw new Error('Vous devez fournir soit un identifiant de parcelle, soit une adresse');
  }
  
  console.log(chalk.green('\n✅ Parcelle trouvée:'));
  console.log(chalk.white(`   📍 ID: ${parcelle.id}`));
  console.log(chalk.white(`   📐 Surface: ${parcelle.surface?.toFixed(2)} m²`));
  
  if (parcelle.batiments && parcelle.batiments.length > 0) {
    const surfaceBatie = parcelle.batiments.reduce((sum, b) => sum + b.surface, 0);
    console.log(chalk.white(`   🏢 Bâtiments: ${parcelle.batiments.length} (${surfaceBatie.toFixed(2)} m²)`));
  }
  
  const pdfService = new PDFGeneratorService();
  const output = outputPath || `output/${parcelle.id}_annotated.pdf`;
  
  console.log(chalk.yellow('\n🎨 Annotation du PDF...'));
  
  await pdfService.annotatePDF(pdfPath, output, [parcelle], {
    showLegend: true,
    showStats: true
  });
  
  console.log(chalk.green.bold('\n✨ PDF généré avec succès !'));
  console.log(chalk.white(`📁 Fichier: ${output}`));
  console.log(chalk.gray('\n💡 Pour ouvrir le fichier:'));
  console.log(chalk.gray(`   start "${output}"  (Windows)`));
}

// Point d'entrée CLI - Exécution directe
const args = process.argv.slice(2);

// Vérifier si le script est exécuté directement
if (process.argv[1]?.includes('level1')) {
  if (args.length >= 2) {
    const pdfPath = resolve(args[0]);
    
    // Vérifier si le deuxième argument est une adresse (contient des lettres/espaces)
    const isAdresse = /[a-zA-Z]/.test(args[1]) || args[1].includes(' ');
    
    if (isAdresse) {
      // Format: level1 <pdf> <adresse> [codePostal] [ville]
      const adresse = args[1];
      const codePostal = args[2] || '';
      const ville = args[3] || '';
      
      level1({
        pdfPath,
        adresse,
        codePostal,
        ville,
        outputPath: args[4]
      }).catch(error => {
        console.error(chalk.red('❌ Erreur:'), error.message);
        process.exit(1);
      });
    } else {
      // Format: level1 <pdf> <parcelle_id>
      level1({
        pdfPath,
        parcelleId: args[1],
        outputPath: args[2]
      }).catch(error => {
        console.error(chalk.red('❌ Erreur:'), error.message);
        process.exit(1);
      });
    }
  } else {
    console.error(chalk.red('\n❌ Arguments manquants\n'));
    console.error(chalk.yellow('Usage:'));
    console.error('  npm run level1 <pdf_path> <parcelle_id>');
    console.error('  npm run level1 <pdf_path> <adresse> [code_postal] [ville]');
    console.error(chalk.gray('\nExemples:'));
    console.error('  npm run level1 plan.pdf 06088LA0123');
    console.error('  npm run level1 plan.pdf "37 avenue Jean Médecin" 06000 Nice');
    console.error('  npm run level1 plan.pdf "15 place de la Bourse" 33000 Bordeaux\n');
    process.exit(1);
  }
}