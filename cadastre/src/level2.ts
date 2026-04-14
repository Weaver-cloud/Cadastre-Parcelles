import { PDFGeneratorService } from './services/pdf-generator.service.js';
import { CadastreAPIService } from './services/cadastre-api.service.js';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import chalk from 'chalk';

interface Level2Options {
  parcelleId: string;
  outputPath?: string;
}

export async function level2(options: Level2Options): Promise<void> {
  const { parcelleId, outputPath } = options;
  
  console.log(chalk.blue.bold('\n🎯 Level 2: Récupération automatique du plan cadastral\n'));
  console.log(chalk.gray(`🏠 Parcelle: ${parcelleId}`));
  
  const apiService = new CadastreAPIService();
  
  console.log(chalk.yellow('🔍 Récupération des données de la parcelle...'));
  const parcelle = await apiService.getParcelleInfo(parcelleId);
  console.log(chalk.green(`✅ Parcelle trouvée: ${parcelle.surface?.toFixed(2)} m²`));
  
  console.log(chalk.yellow('📥 Téléchargement du plan cadastral...'));
  const pdfBuffer = await apiService.downloadCadastrePDF(
    parcelle.commune,
    parcelle.section
  );
  
  const tempPdfPath = `output/temp_${parcelleId}_${Date.now()}.pdf`;
  await mkdir(dirname(tempPdfPath), { recursive: true });
  await writeFile(tempPdfPath, pdfBuffer);
  console.log(chalk.green('✅ Plan cadastral téléchargé'));
  
  const pdfService = new PDFGeneratorService();
  const output = outputPath || `output/${parcelleId}_level2_complete.pdf`;
  
  console.log(chalk.yellow('🎨 Annotation du PDF...'));
  await pdfService.annotatePDF(tempPdfPath, output, [parcelle], {
    showLegend: true,
    showStats: true
  });
  
  console.log(chalk.green.bold('\n✨ PDF généré avec succès !'));
  console.log(chalk.white(`📁 Fichier: ${output}`));
  
  const surfaceBatie = parcelle.batiments?.reduce((sum, b) => sum + b.surface, 0) || 0;
  const occupation = parcelle.surface ? (surfaceBatie / parcelle.surface) * 100 : 0;
  
  console.log(chalk.cyan('\n📊 Statistiques:'));
  console.log(chalk.white(`   - Surface totale: ${parcelle.surface?.toFixed(2)} m²`));
  console.log(chalk.white(`   - Surface bâtie: ${surfaceBatie.toFixed(2)} m²`));
  console.log(chalk.white(`   - Occupation: ${occupation.toFixed(1)}%`));
}

// Point d'entrée CLI
if (process.argv[1]?.includes('level2')) {
  const args = process.argv.slice(2);
  
  if (args.length >= 1) {
    level2({
      parcelleId: args[0],
      outputPath: args[1]
    }).catch(error => {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    });
  } else {
    console.error(chalk.red('\n❌ Arguments manquants\n'));
    console.error(chalk.yellow('Usage: npm run level2 <parcelle_id> [output_path]'));
    console.error(chalk.gray('Example: npm run level2 06088LA0123\n'));
    process.exit(1);
  }
}