const fs = require('fs');
const path = require('path');

// Utility for cleaning temp files
function cleanupTempFiles() {
    const tempDir = path.join(process.cwd(), 'temp');
    
    if (!fs.existsSync(tempDir)) {
        return;
    }
    
    fs.readdir(tempDir, (err, files) => {
        if (err) {
            console.error('Error reading temp directory:', err);
            return;
        }
        
        let cleanedCount = 0;
        const now = Date.now();
        const maxAge = 3 * 60 * 60 * 1000; // 3 hours
        
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                
                // Delete files older than 3 hours
                if (now - stats.mtimeMs > maxAge) {
                    fs.unlink(filePath, (err) => {
                        if (!err) {
                            cleanedCount++;
                            console.log(`🧹 Cleaned temp file: ${file}`);
                        }
                    });
                }
            });
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned ${cleanedCount} temp files`);
        }
    });
}

// Cleanup on startup
cleanupTempFiles();

// Cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

module.exports = { cleanupTempFiles };

