import fs from "fs";
import path from "path";
import readline from "readline";

// GTFS Schema interfaces
interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type: number;
  parent_station: string;
  platform_code: string;
}

interface GtfsRoute {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  route_color: string;
  route_text_color: string;
}

/**
 * GTFS Parser class demonstrating build-time preprocessing of Transport for NSW schedule feeds.
 * Helps condense 100MB+ of GTFS static text files into a compact, indexable JSON asset for mobile search.
 */
export class GtfsParser {
  private inputDir: string;
  private outputDir: string;

  constructor(inputDir: string, outputDir: string) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
  }

  /**
   * Helper to parse CSV rows with quotes support
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Parses stops.txt from TfNSW feed and maps them to structured stations.
   */
  async parseStops(filename: string = "stops.txt"): Promise<any[]> {
    const filePath = path.join(this.inputDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filename} not found at ${filePath}. Returning empty mock array.`);
      return [];
    }

    const stops: any[] = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let headers: string[] = [];
    let isHeader = true;

    for await (const line of rl) {
      if (isHeader) {
        headers = this.parseCsvLine(line);
        isHeader = false;
        continue;
      }

      const values = this.parseCsvLine(line);
      if (values.length < headers.length) continue;

      const stop: any = {};
      headers.forEach((h, idx) => {
        stop[h] = values[idx];
      });

      // Filter and map only Sydney key locations (Parent hubs are location_type === 1)
      const isParentHub = parseInt(stop.location_type || "0") === 1;
      const lat = parseFloat(stop.stop_lat || "0");
      const lon = parseFloat(stop.stop_lon || "0");

      // Verify coordinate ranges bounding Greater Sydney region
      const inSydneyRegion = lat < -33.0 && lat > -34.5 && lon > 150.5 && lon < 151.6;

      if (isParentHub && inSydneyRegion) {
        // Infer transit system mode from station ID patterns typical of TfNSW
        let mode = "bus";
        if (stop.stop_id.startsWith("1010")) {
          mode = "train";
        } else if (stop.stop_id.includes("Metro")) {
          mode = "metro";
        } else if (stop.stop_id.startsWith("101015")) {
          mode = "lightrail";
        } else if (stop.stop_id.startsWith("10102")) {
          mode = "ferry";
        }

        stops.push({
          id: stop.stop_id,
          name: stop.stop_name.replace(/ Station$/, "").replace(/ Light Rail$/, ""),
          lat,
          lon,
          mode,
          code: stop.stop_code || null,
        });
      }
    }

    return stops;
  }

  /**
   * Main orchestrator that aggregates stops and writes to compressed static asset folder.
   */
  async processFeed() {
    console.log("Starting TfNSW GTFS Static feed processing...");
    try {
      const parsedStops = await this.parseStops();
      const outputFilePath = path.join(this.outputDir, "sydney-stations.json");
      
      // Ensure target directory exists
      fs.mkdirSync(this.outputDir, { recursive: true });

      // Save processed nodes as compressed JSON structure
      fs.writeFileSync(outputFilePath, JSON.stringify(parsedStops, null, 2), "utf8");
      console.log(`Successfully compiled ${parsedStops.length} Sydney hubs. Saved to: ${outputFilePath}`);
    } catch (error) {
      console.error("Error preprocessing GTFS feed:", error);
    }
  }
}

// Script run command invocation example:
// new GtfsParser('./gtfs-static', './src/assets/data').processFeed();
