import { PDFGeneratorService } from './services/pdf-generator.service.js';
import { CadastreAPIService } from './services/cadastre-api.service.js';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Parcelle } from './types/cadastre.types.js';
import chalk from 'chalk';

interface Level3Options {
  parcelleIds: string[];
  outputPath?: string;
}

export async function level3(options: Level3Options): Promise<void> {
  const { parcelleIds, outputPath } = options;
  
  console.log(chalk.blue.bold('\n🎯 Level 3: Plusieurs parcelles adjacentes\n'));
  console.log(chalk.gray(`🏠 Parcelles: ${parcelleIds.join(', ')}`));
  
  const apiService = new CadastreAPIService();
  
  console.log(chalk.yellow('🔍 Récupération des données des parcelles...'));
  const parcelles: Parcelle[] = [];
  
  for (const id of parcelleIds) {
    try {
      const parcelle = await apiService.getParcelleInfo(id);
      parcelles.push(parcelle);
      console.log(chalk.green(`  ✅ ${id}: ${parcelle.surface?.toFixed(2)} m²`));
    } catch (error) {
      console.error(chalk.red(`  ❌ ${id}: ${error}`));
    }
  }
  
  if (parcelles.length === 0) {
    throw new Error('Aucune parcelle valide trouvée');
  }
  
  const premiereParcelle = parcelles[0];
  console.log(chalk.yellow('\n📥 Téléchargement du plan cadastral...'));
  const pdfBuffer = await apiService.downloadCadastrePDF(
    premiereParcelle.commune,
    premiereParcelle.section
  );
  
  const tempPdfPath = `output/temp_multi_${Date.now()}.pdf`;
  await mkdir(dirname(tempPdfPath), { recursive: true });
  await writeFile(tempPdfPath, pdfBuffer);
  console.log(chalk.green('✅ Plan cadastral téléchargé'));
  
  const pdfService = new PDFGeneratorService();
  const output = outputPath || `output/multi_parcelles_${Date.now()}.pdf`;
  
  console.log(chalk.yellow('🎨 Annotation du PDF...'));
  await pdfService.annotatePDF(tempPdfPath, output, parcelles, {
    showLegend: true,
    showStats: false
  });
  
  console.log(chalk.green.bold('\n✨ PDF généré avec succès !'));
  console.log(chalk.white(`📁 Fichier: ${output}`));
}

// Point d'entrée CLI
if (process.argv[1]?.includes('level3')) {
  const args = process.argv.slice(2);
  
  if (args.length >= 1) {
    const parcelleIds = args[0].split(',').map(id => id.trim());
    
    level3({
      parcelleIds,
      outputPath: args[1]
    }).catch(error => {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    });
  } else {
    console.error(chalk.red('\n❌ Arguments manquants\n'));
    console.error(chalk.yellow('Usage: npm run level3 <parcelle_id1,parcelle_id2,...> [output_path]'));
    console.error(chalk.gray('Example: npm run level3 "06088LA0123,06088LA0124"\n'));
    process.exit(1);
  }
}