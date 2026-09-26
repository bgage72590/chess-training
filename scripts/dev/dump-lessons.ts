// Dumps the curriculum as JSON for the browser lesson walkthrough (e2e-lessons.cjs).
import { units } from '../../src/content/index.ts';
process.stdout.write(JSON.stringify(units.map((u) => ({ id: u.id, lessons: u.lessons }))));
