import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
    { src: "Helvetica-Oblique", fontStyle: "italic" },
    { src: "Helvetica-BoldOblique", fontWeight: "bold", fontStyle: "italic" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    textAlign: "center",
    color: "#555",
    marginBottom: 20,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    borderBottom: 1,
    paddingBottom: 3,
    borderBottomColor: "#333",
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 140,
    fontWeight: "bold",
    fontSize: 10,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  clause: {
    marginBottom: 6,
    fontSize: 10,
  },
  clauseTitle: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  signature: {
    marginTop: 30,
    borderTop: 1,
    borderTopColor: "#333",
    paddingTop: 8,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  signatureBlock: {
    width: "45%",
  },
  signatureLine: {
    borderBottom: 1,
    borderBottomColor: "#333",
    marginBottom: 4,
    marginTop: 30,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#888",
  },
  header: {
    position: "absolute",
    top: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#888",
  },
});

interface ContractPdfProps {
  tenantName: string;
  propertyAddress: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  contractText: string;
  landlordName?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseContractSections(text: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = text.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isHeading =
      trimmed.match(/^#{1,3}\s/) ||
      (trimmed.match(/^[A-Z][A-Z\s&,.]+$/) && trimmed.length > 3 && trimmed.length < 80) ||
      trimmed.match(/^\d+[\.\)]\s/);

    if (isHeading && currentContent.length > 0) {
      sections.push({
        title: currentTitle || "Introduction",
        content: currentContent.join("\n").trim(),
      });
      currentTitle = trimmed.replace(/^#{1,3}\s/, "").replace(/^\d+[\.\)]\s/, "");
      currentContent = [];
    } else if (isHeading && !currentTitle) {
      currentTitle = trimmed.replace(/^#{1,3}\s/, "").replace(/^\d+[\.\)]\s/, "");
    } else {
      currentContent.push(trimmed);
    }
  }

  if (currentContent.length > 0 || currentTitle) {
    sections.push({
      title: currentTitle || "Additional Terms",
      content: currentContent.join("\n").trim(),
    });
  }

  return sections.length > 0 ? sections : [{ title: "Terms", content: text }];
}

export function ContractPdf({
  tenantName,
  propertyAddress,
  contractType,
  startDate,
  endDate,
  monthlyRent,
  depositAmount,
  contractText,
  landlordName = "Landlord",
}: ContractPdfProps) {
  const sections = parseContractSections(contractText);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text>Letora Property Management</Text>
          <Text>Generated: {today}</Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={styles.title}>{contractType || "Assured Shorthold Tenancy"}</Text>
          <Text style={styles.subtitle}>Tenancy Agreement</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties & Property</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Landlord / Agent:</Text>
            <Text style={styles.value}>{landlordName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tenant:</Text>
            <Text style={styles.value}>{tenantName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Property:</Text>
            <Text style={styles.value}>{propertyAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tenancy Start:</Text>
            <Text style={styles.value}>{formatDate(startDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tenancy End:</Text>
            <Text style={styles.value}>{formatDate(endDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monthly Rent:</Text>
            <Text style={styles.value}>{formatGbp(monthlyRent)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Deposit:</Text>
            <Text style={styles.value}>{formatGbp(depositAmount)}</Text>
          </View>
        </View>

        {sections.map((section, idx) => (
          <View style={styles.section} key={idx}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.clause}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.signature}>
          <Text style={{ fontWeight: "bold", marginBottom: 4 }}>Signatures</Text>
          <Text style={{ fontSize: 9, color: "#555" }}>
            By signing below, both parties agree to the terms and conditions set out in this agreement.
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={{ fontSize: 9, fontWeight: "bold" }}>Landlord / Agent</Text>
              <View style={styles.signatureLine} />
              <Text style={{ fontSize: 8, color: "#666" }}>Signature</Text>
              <Text style={{ fontSize: 8, color: "#666", marginTop: 2 }}>Date: {today}</Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={{ fontSize: 9, fontWeight: "bold" }}>Tenant</Text>
              <View style={styles.signatureLine} />
              <Text style={{ fontSize: 8, color: "#666" }}>Signature</Text>
              <Text style={{ fontSize: 8, color: "#666", marginTop: 2 }}>Date:</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated by Letora. This document is legally binding once signed by both parties.
        </Text>
      </Page>
    </Document>
  );
}
