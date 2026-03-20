import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadImages() {
    const bucket = 'Mil VN Images';
    const folder = 'uploads';
    const outDir = path.join(process.cwd(), 'public', folder);

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log(`Fetching list of files from Supabase bucket '${bucket}' in folder '${folder}'...`);

    // List all files in the bucket's folder
    const { data: files, error } = await supabase.storage.from(bucket).list(folder, {
        limit: 10000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
        console.error('Error listing files:', error.message);
        process.exit(1);
    }

    if (!files || files.length === 0) {
        console.log('No files found to download.');
        process.exit(0);
    }

    const filesToDownload = files.filter(f => f.name !== '.emptyFolderPlaceholder' && f.id);
    console.log(`Found ${filesToDownload.length} images to download.`);

    let successCount = 0;

    for (const file of filesToDownload) {
        const filePath = `${folder}/${file.name}`;
        const localPath = path.join(outDir, file.name);

        console.log(`Downloading ${file.name}...`);

        const { data, error: downloadError } = await supabase.storage.from(bucket).download(filePath);

        if (downloadError) {
            console.error(`❌ Failed to download ${file.name}:`, downloadError.message);
            continue;
        }

        if (data) {
            const buffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(localPath, buffer);
            successCount++;
        }
    }

    console.log(`\n🎉 Successfully downloaded ${successCount}/${filesToDownload.length} images to ${outDir}`);
}

downloadImages();
