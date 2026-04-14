#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';
import { level4 } from './level4.js';
import { CadastreAPIService } from './services/cadastre-api.service.js';

interface CLIAnswers {
  level: '1' | '2' | '3' | '4';
  mode: 'manual' | 'interactive' | 'adresse';
}

interface Commune {
  code: string;
  nom: string;
}

async function main() {
  console.log(chalk.blue.bold('\n🏗️  Cadastre Extractor - Extraction automatique de parcelles\n'));
  
  const { level } = await inquirer.prompt<{ level: '1' | '2' | '3' | '4' }>([{
    type: 'list',
    name: 'level',
    message: 'Choisissez le niveau de fonctionnalité:',
    choices: [
      { name: 'Level 1 - Annoter un PDF existant', value: '1' },
      { name: 'Level 2 - Télécharger et annoter automatiquement', value: '2' },
      { name: 'Level 3 - Plusieurs parcelles adjacentes', value: '3' },
      { name: 'Level 4 - Statistiques de surfaces', value: '4' }
    ]
  }]);
  
  // Pour le Level 1, proposer le mode adresse
  let modeChoices = [
    { name: 'Manuel (saisie directe de l\'ID parcelle)', value: 'manual' },
    { name: 'Interactif (recherche guidée par commune)', value: 'interactive' }
  ];
  
  if (level === '1') {
    modeChoices.push({ name: 'Par adresse (recherche par adresse postale)', value: 'adresse' });
  }
  
  const { mode } = await inquirer.prompt<{ mode: 'manual' | 'interactive' | 'adresse' }>([{
    type: 'list',
    name: 'mode',
    message: 'Mode de fonctionnement:',
    choices: modeChoices
  }]);
  
  const apiService = new CadastreAPIService();
  
  // Mode par adresse (Level 1 uniquement)
  if (mode === 'adresse') {
    console.log(chalk.yellow('\n📍 Mode recherche par adresse\n'));
    
    const { pdfPath } = await inquirer.prompt([{
      type: 'input',
      name: 'pdfPath',
      message: 'Chemin du PDF source:',
      default: 'input/plan.pdf'
    }]);
    
    const { adresse } = await inquirer.prompt([{
      type: 'input',
      name: 'adresse',
      message: 'Adresse complète (ex: 37 avenue Jean Médecin):'
    }]);
    
    const { codePostal } = await inquirer.prompt([{
      type: 'input',
      name: 'codePostal',
      message: 'Code postal:',
      default: ''
    }]);
    
    const { ville } = await inquirer.prompt([{
      type: 'input',
      name: 'ville',
      message: 'Ville:',
      default: ''
    }]);
    
    const spinner = ora('Recherche de la parcelle...').start();
    
    try {
      const parcelle = await apiService.getParcelleFromAdresse(adresse, codePostal, ville);
      spinner.stop();
      
      if (!parcelle) {
        console.log(chalk.red('❌ Impossible de trouver la parcelle pour cette adresse'));
        return;
      }
      
      console.log(chalk.green(`\n✅ Parcelle trouvée: ${parcelle.id}`));
      console.log(chalk.white(`   Surface: ${parcelle.surface?.toFixed(2)} m²`));
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Continuer avec cette parcelle ?',
        default: true
      }]);
      
      if (!confirm) {
        console.log(chalk.yellow('Annulé'));
        return;
      }
      
      await level1({ pdfPath, parcelleId: parcelle.id });
      
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Erreur:'), error);
    }
    
    return;
  }
  
  // Mode interactif (recherche par commune)
  if (mode === 'interactive') {
    console.log(chalk.yellow('\n🔍 Mode interactif - Recherche de parcelles\n'));
    
    const { nomCommune } = await inquirer.prompt([{
      type: 'input',
      name: 'nomCommune',
      message: 'Nom de la commune:'
    }]);
    
    const spinner = ora('Recherche de la commune...').start();
    const communes = await apiService.searchCommune(nomCommune) as Commune[];
    spinner.stop();
    
    if (communes.length === 0) {
      console.log(chalk.red('Aucune commune trouvée'));
      return;
    }
    
    const { codeCommune } = await inquirer.prompt([{
      type: 'list',
      name: 'codeCommune',
      message: 'Sélectionnez la commune:',
      choices: communes.slice(0, 15).map(c => ({ 
        name: `${c.nom} (${c.code})`, 
        value: c.code 
      }))
    }]);
    
    spinner.start('Recherche des parcelles...');
    const parcelles = await apiService.searchParcelles(codeCommune);
    spinner.stop();
    
    if (parcelles.length === 0) {
      console.log(chalk.red('Aucune parcelle trouvée pour cette commune'));
      return;
    }
    
    console.log(chalk.green(`\n✅ ${parcelles.length} parcelles trouvées\n`));
    
    let parcelleIds: string[] = [];
    
    if (level === '3' || level === '4') {
      const { selectedParcelles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedParcelles',
        message: 'Sélectionnez les parcelles (espace pour sélectionner):',
        choices: parcelles.slice(0, 30).map(p => ({ name: p, value: p })),
        pageSize: 15,
        validate: (answer: string[]) => {
          if (answer.length < 1) return 'Sélectionnez au moins une parcelle';
          if (answer.length > 5) return 'Maximum 5 parcelles recommandé';
          return true;
        }
      }]);
      parcelleIds = selectedParcelles;
    } else {
      const { selectedParcelle } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedParcelle',
        message: 'Sélectionnez la parcelle:',
        choices: parcelles.slice(0, 30).map(p => ({ name: p, value: p })),
        pageSize: 15
      }]);
      parcelleIds = [selectedParcelle];
    }
    
    if (level === '1') {
      const { pdfPath } = await inquirer.prompt([{
        type: 'input',
        name: 'pdfPath',
        message: 'Chemin du PDF source:',
        default: 'input/plan.pdf'
      }]);
      
      await level1({ pdfPath, parcelleId: parcelleIds[0] });
    } else {
      await executeLevel(level, parcelleIds);
    }
    
    return;
  }
  
  // Mode manuel
  console.log(chalk.yellow('\n📝 Mode manuel - Saisie directe\n'));
  
  if (level === '1') {
    const { pdfPath } = await inquirer.prompt([{
      type: 'input',
      name: 'pdfPath',
      message: 'Chemin du PDF source:',
      default: 'input/plan.pdf'
    }]);
    
    const { parcelleId } = await inquirer.prompt([{
      type: 'input',
      name: 'parcelleId',
      message: 'Identifiant de la parcelle (ex: 06088LA0123):',
      validate: (input: string) => {
        if (input.length < 10) return 'Identifiant trop court';
        return true;
      }
    }]);
    
    await level1({ pdfPath, parcelleId });
    
  } else if (level === '2') {
    const { parcelleId } = await inquirer.prompt([{
      type: 'input',
      name: 'parcelleId',
      message: 'Identifiant de la parcelle:',
      validate: (input: string) => {
        if (input.length < 10) return 'Identifiant trop court';
        return true;
      }
    }]);
    
    await level2({ parcelleId });
    
  } else {
    const { parcelleIds } = await inquirer.prompt([{
      type: 'input',
      name: 'parcelleIds',
      message: 'Identifiants des parcelles (séparés par des virgules):',
      validate: (input: string) => {
        const ids = input.split(',').map(id => id.trim());
        if (ids.length < 1) return 'Au moins une parcelle requise';
        return true;
      }
    }]);
    
    const ids = parcelleIds.split(',').map((id: string) => id.trim());
    await executeLevel(level, ids);
  }
}

async function executeLevel(level: string, parcelleIds: string[]): Promise<void> {
  const spinner = ora('Traitement en cours...').start();
  
  try {
    switch (level) {
      case '2':
        await level2({ parcelleId: parcelleIds[0] });
        break;
      case '3':
        await level3({ parcelleIds });
        break;
      case '4':
        await level4({ parcelleIds });
        break;
    }
    
    spinner.succeed(chalk.green('Traitement terminé avec succès!'));
    console.log(chalk.green('\n✨ Les fichiers ont été générés dans le dossier output/\n'));
    
    // Afficher les fichiers générés
    console.log(chalk.cyan('📁 Fichiers générés:'));
    if (level === '2') {
      console.log(chalk.gray(`   - output/${parcelleIds[0]}_level2_complete.pdf`));
    } else {
      console.log(chalk.gray(`   - output/multi_parcelles_*.pdf ou stats_parcelles_*.pdf`));
    }
    
  } catch (error) {
    spinner.fail(chalk.red('Erreur lors du traitement'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

main().catch(console.error);

export { main };