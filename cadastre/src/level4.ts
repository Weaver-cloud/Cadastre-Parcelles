import { PDFGeneratorService } from './services/pdf-generator.service.js';
import { CadastreAPIService } from './services/cadastre-api.service.js';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Parcelle, ParcelleStats } from './types/cadastre.types.js';
import chalk from 'chalk';

interface Level4Options {
  parcelleIds: string[];
  outputPath?: string;
}

export async function level4(options: Level4Options): Promise<void> {
  const { parcelleIds, outputPath } = options;
  
  console.log(chalk.blue.bold('\n🎯 Level 4: Encart avec surfaces bâties et non bâties\n'));
  console.log(chalk.gray(`🏠 Parcelles: ${parcelleIds.join(', ')}`));
  
  const apiService = new CadastreAPIService();
  
  console.log(chalk.yellow('🔍 Récupération des données détaillées des parcelles...'));
  const parcelles: Parcelle[] = [];
  
  for (const id of parcelleIds) {
    try {
      const parcelle = await apiService.getParcelleInfo(id);
      parcelles.push(parcelle);
      
      const surfaceBatie = parcelle.batiments?.reduce((sum, b) => sum + b.surface, 0) || 0;
      const occupation = parcelle.surface ? (surfaceBatie / parcelle.surface) * 100 : 0;
      
      console.log(chalk.green(`  ✅ ${id}:`));
      console.log(chalk.white(`     Surface totale: ${parcelle.surface?.toFixed(2)} m²`));
      console.log(chalk.white(`     Surface bâtie: ${surfaceBatie.toFixed(2)} m² (${occupation.toFixed(1)}%)`));
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
  
  const tempPdfPath = `output/temp_stats_${Date.now()}.pdf`;
  await mkdir(dirname(tempPdfPath), { recursive: true });
  await writeFile(tempPdfPath, pdfBuffer);
  console.log(chalk.green('✅ Plan cadastral téléchargé'));
  
  const pdfService = new PDFGeneratorService();
  const output = outputPath || `output/stats_parcelles_${Date.now()}.pdf`;
  
  console.log(chalk.yellow('🎨 Annotation du PDF avec statistiques...'));
  await pdfService.annotatePDF(tempPdfPath, output, parcelles, {
    showLegend: true,
    showStats: true
  });
  
  console.log(chalk.green.bold('\n✨ PDF généré avec succès !'));
  console.log(chalk.white(`📁 Fichier: ${output}`));
}

// Point d'entrée CLI
if (process.argv[1]?.includes('level4')) {
  const args = process.argv.slice(2);
  
  if (args.length >= 1) {
    const parcelleIds = args[0].split(',').map(id => id.trim());
    
    level4({
      parcelleIds,
      outputPath: args[1]
    }).catch(error => {
      console.error(chalk.red('❌ Erreur:'), error.message);
      process.exit(1);
    });
  } else {
    console.error(chalk.red('\n❌ Arguments manquants\n'));
    console.error(chalk.yellow('Usage: npm run level4 <parcelle_id1,parcelle_id2,...> [output_path]'));
    console.error(chalk.gray('Example: npm run level4 "06088LA0123,06088LA0124"\n'));
    process.exit(1);
  }
}