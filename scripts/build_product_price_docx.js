/**
 * Product Price List — Word document table (Product | Price)
 * Same data as hayaan-product-price-list.xlsx, formatted per user's uploaded image.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, PageNumber, AlignmentType, HeadingLevel, WidthType, BorderStyle,
  ShadingType,
} = require("docx");
const fs = require("fs");

const OUT = "/home/z/my-project/download/hayaan-product-price-list.docx";

// ---------- data (verified prices from sanguni.so scrape, 17 Sep 2026) ----------
const SECTIONS = [
  ["Tier 1 — Power, Charging & Audio (fastest rotation)", [
    ["Power Bank Green Lion Thunder 80,000mAh", 65.00],
    ["Power Bank Lion Ultra-Thin 20,000mAh 120W", 49.90],
    ["Power Bank Anker MagGo 10,000mAh", 48.00],
    ["Power Bank Anker Zolo 10,000mAh", 45.00],
    ["Power Bank Porodo Chrome Volt 10,000mAh", 25.00],
    ["Power Bank Porodo Pocket Volt 10,000mAh", 22.00],
    ["Power Bank Maxvolt 10,000mAh", 24.00],
    ["Power Bank Aston MagSafe 10,000mAh", 22.00],
    ["Power Bank Porodo 5,000mAh with Lightning", 15.00],
    ["Battery Case iPhone 16 Pro Max 7000mAh", 45.00],
    ["Battery Case iPhone 17 Pro Max 7000mAh", 56.00],
    ["Anker Prime 100W 3-Port GaN Wall Charger", 65.00],
    ["Apple 20W USB-C Power Adapter (Original)", 25.00],
    ["WiWU Helix 65W Fast Charger", 18.00],
    ["Adaptor USB-C 25W PD", 4.50],
    ["Cable Charge USB-C to Lightning 1M", 2.00],
    ["Cable Charge USB-C 1M", 3.00],
    ["Cable Charge 60W USB-C 1M", 22.00],
    ["Cable Charge 240W USB-C 2M", 25.00],
    ["Anker Boom 3i Outdoor Bluetooth Speaker", 16.70],
    ["Headphone EarPods USB-C Wired", 4.00],
    ["Earphone Samsung 3.5mm Jack", 1.50],
    ["Headphone Samsung Type-C", 18.00],
    ["Headphone iPhone Wired", 24.00],
    ["AirPods Pro 3 / Pro 2 / AirPods 4 ANC", null],
    ["Galaxy Buds 3 / 4 Pro / Buds FE", null],
    ["Maxwell Smart Watch (budget line)", 55.00],
    ["Digital Voltage Stabilizer Lightwave", 11.50],
  ]],
  ["Tier 2 — Smartphones & Wearables", [
    ["Samsung Galaxy A06", 110.00],
    ["Samsung Galaxy A07", 125.00],
    ["Samsung Galaxy A16", 118.00],
    ["Samsung Galaxy A17", 165.00],
    ["Samsung Galaxy A36 5G", 285.00],
    ["Samsung Galaxy A37 5G", 320.00],
    ["Samsung Galaxy S25 / S26 Ultra", null],
    ["iPhone 17 (Physical SIM)", 990.00],
    ["iPhone 16 Pro", 1120.00],
    ["iPhone 15 Pro Max", 1170.00],
    ["iPhone 16 Pro Max", 1240.00],
    ["iPhone Air", 1280.00],
    ["iPhone 17 Pro (Physical SIM)", 1420.00],
    ["iPhone 17 Pro Max (Physical SIM)", 1550.00],
    ["Amazfit Active 42mm Smart Watch", 130.00],
    ["Samsung Galaxy Watch 7 44mm", 190.00],
    ["Huawei Watch GT 6 GPS 46mm", 230.00],
    ["Apple Watch SE 40mm", 250.00],
    ["Apple Watch Series 9 45mm", 360.00],
    ["Apple Watch Series 10 46mm", 390.00],
    ["Apple Watch Series 11 46mm", 440.00],
  ]],
  ["Tier 3 — Computers, TV & Gaming (big ticket)", [
    ["HP EliteBook 840 G7 Notebook", 310.00],
    ["HP EliteBook 830 G7 Intel Core i7-10Gen", 340.00],
    ["HP EliteBook 830 G8 Intel Core i7-11Gen", 380.00],
    ["HP EliteBook 840 G9 Intel Core i7-12Gen", 950.00],
    ["Lenovo ThinkPad E14 / T14 / X13", null],
    ["Asus TUF FX507 Gaming i7-13Gen", 1320.00],
    ["MacBook Pro M3", 1350.00],
    ["MacBook Air M5", 1530.00],
    ["MacBook Pro M4", 1720.00],
    ["MacBook Pro M5", 1900.00],
    ["iPad 9 / 10 / 11 (Wi-Fi)", null],
    ["iPad Pro M4 / M5 11\" / 13\"", null],
    ["Samsung Galaxy Tab A11", null],
    ["TV Geepas Smart 32\"", 175.00],
    ["TV Geepas Smart 43\"", 210.00],
    ["TV LG 43-Inch Smart", 450.00],
    ["TV LG 55-Inch Smart", 650.00],
    ["TV LG 65-Inch Smart", 850.00],
    ["TV LG 75-Inch Smart", 1290.00],
    ["TV Samsung 85-Inch Smart", 2350.00],
    ["PlayStation 5 Digital Edition (Slim)", 720.00],
    ["PlayStation Sony 5 Pro 2TB Slim", 1180.00],
    ["Xiaomi TV Stick / TV Box S 4K", null],
    ["Speaker Outdoor L208 100W", 70.00],
    ["Projector Maxwell Spectra", 120.00],
    ["Projector Epson CO-W01", 350.00],
    ["Projector Screen Manual 180x180cm", 90.00],
  ]],
  ["Tier 4 — Home, Office & Networking (steady sellers)", [
    ["Geepas Electric Kettle", 15.00],
    ["Geepas Blender 2in1", 25.00],
    ["Geepas Blender 4in1", 39.90],
    ["Sandwich Maker Geepas", 25.00],
    ["Popcorn Maker Geepas", 20.00],
    ["Rice Cooker Geepas with Steamer", 46.00],
    ["Geepas Coffee Maker 1.5L", 35.00],
    ["Geepas Mini Oven and Grill 48L", 75.00],
    ["Hot Air Styler TP-5+1", 10.00],
    ["Water Dispenser Light Wave", 120.00],
    ["Air Conditioner Lightwave 9K", 260.00],
    ["Air Conditioner Lightwave 12K", 280.00],
    ["Air Conditioner Lightwave 18K", 390.00],
    ["Air Conditioner Lightwave 24K", 460.00],
    ["TP-Link 840N Wi-Fi Router", 15.00],
    ["TP-Link AC750 Wireless Dual Band Router", 24.90],
    ["TP-Link AC1200 WiFi Range Extender", 36.00],
    ["TP-Link Omada AC1350 Access Point", 85.00],
    ["MikroTik L009 series Router", 135.00],
    ["UniFi AP AC PRO Wireless Access Point", 145.00],
    ["HP Printer Laser 107A", 75.00],
    ["HP Printer Laser MFP 135A", 165.00],
    ["Epson EcoTank L3210 / L3250", null],
    ["HP Toner Cartridge 651A Original Set", 277.00],
    ["Zebra Barcode Printer ZD220T", null],
    ["POS Receipt Printer TP600 80mm", null],
    ["Microphone DJI Mic Mini 2", 33.30],
    ["DJI Osmo Pocket 3 / 4 Creator Combo", null],
    ["GoPro Max 2 True 8K 360 Camera", null],
    ["Aputure Amaran 200XS Studio Light", 330.00],
    ["Battery for Canon LPE10 Normal", 18.00],
    ["Memory Card 128GB / 256GB Extreme Pro", null],
  ]],
];

const fmtUSD = (n) => "$" + n.toFixed(2);
const FONT = { ascii: "Times New Roman", eastAsia: "Times New Roman" };

// light full-grid borders to match the user's sketch
const gridBorders = {
  top: { style: BorderStyle.SINGLE, size: 6, color: "404040" },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: "404040" },
  left: { style: BorderStyle.SINGLE, size: 6, color: "404040" },
  right: { style: BorderStyle.SINGLE, size: 6, color: "404040" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "808080" },
};

const cellMargins = { top: 80, bottom: 80, left: 140, right: 140 };

function headerCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: "1F3864" },
    margins: cellMargins,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 312 },
      children: [new TextRun({ text, bold: true, size: 24, color: "FFFFFF", font: FONT })],
    })],
  });
}

function productCell(text, shaded) {
  return new TableCell({
    width: { size: 72, type: WidthType.PERCENTAGE },
    margins: cellMargins,
    shading: shaded ? { type: ShadingType.CLEAR, fill: "F2F5F9" } : undefined,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 312 },
      children: [new TextRun({ text, size: 22, color: "000000", font: FONT })],
    })],
  });
}

function priceCell(price, shaded) {
  return new TableCell({
    width: { size: 28, type: WidthType.PERCENTAGE },
    margins: cellMargins,
    shading: shaded ? { type: ShadingType.CLEAR, fill: "F2F5F9" } : undefined,
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { line: 312 },
      children: [new TextRun({ text: price === null ? "" : fmtUSD(price), size: 22, color: "000000", font: FONT })],
    })],
  });
}

function buildTable(items) {
  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [headerCell("Product", 72), headerCell("Price", 28)],
    }),
    ...items.map(([name, price], i) => new TableRow({
      cantSplit: true,
      children: [productCell(name, i % 2 === 0), priceCell(price, i % 2 === 0)],
    })),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    rows,
  });
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "1F3864", font: FONT })],
  });
}

// ---------- assemble ----------
const children = [
  // document title (not a Heading style — it is the doc title, not a TOC target)
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120, line: 760, lineRule: "atLeast" },
    children: [new TextRun({ text: "Product Price List", bold: true, size: 56, color: "1F3864", font: FONT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 320, line: 312 },
    children: [new TextRun({
      text: "In-demand electronics for Somalia — reference prices sourced from sanguni.so (17 September 2026)",
      italics: true, size: 21, color: "595959", font: FONT,
    })],
  }),
];

for (const [title, items] of SECTIONS) {
  children.push(sectionHeading(title));
  children.push(buildTable(items));
}

// notes
children.push(new Paragraph({
  spacing: { before: 360, after: 60, line: 312 },
  children: [new TextRun({
    text: "Notes:",
    bold: true, size: 21, color: "595959", font: FONT,
  })],
}));
children.push(new Paragraph({
  spacing: { after: 40, line: 312 },
  children: [new TextRun({
    text: "1. Prices are Sanguni retail reference prices in USD; some were converted from Somali Shillings at approximately 570 SOS/USD.",
    size: 20, color: "595959", font: FONT,
  })],
}));
children.push(new Paragraph({
  spacing: { after: 40, line: 312 },
  children: [new TextRun({
    text: "2. Blank price cells mean the item was not listed on Sanguni — fill in your own cost or selling price.",
    size: 20, color: "595959", font: FONT,
  })],
}));
children.push(new Paragraph({
  spacing: { after: 40, line: 312 },
  children: [new TextRun({
    text: "3. Total items: 108 across 4 tiers. Tier 1 items have the fastest rotation for online sales in Somalia.",
    size: 20, color: "595959", font: FONT,
  })],
}));

const doc = new Document({
  creator: "Z.ai",
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 22, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 28, bold: true, color: "1F3864" },
        paragraph: { spacing: { before: 320, after: 160, line: 312 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT })],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  const total = SECTIONS.reduce((a, [, items]) => a + items.length, 0);
  console.log("SAVED", OUT, "| sections:", SECTIONS.length, "| items:", total);
});
