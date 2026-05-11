import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
    const fileId = "cmp0by94j0004omrose2jhbgr";
    
    const file = await prisma.moduleSourceFile.findUnique({
        where: { id: fileId }
    });
    
    console.log("File Status:", file?.status);
    console.log("Error Message:", file?.errorMessage);
    
    const chunksCount = await prisma.moduleSourceChunk.count({
        where: { fileId }
    });
    
    console.log("Chunks Count:", chunksCount);
    
    process.exit(0);
}

check();
