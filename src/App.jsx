import React, { useMemo, useState } from "react";
import {
  Container,
  View,
  Text,
  Button,
  Table,
  TextField,
  FormControl
} from "reshaped";

// Create a blank cabinet row
const createEmptyRow = (id) => ({
  id,
  cabinetHeight: "",
  kickHeight: "",
  boxHeight: "",
  boxWidth: "",
  boxDepth: "",
  braceHeight: "",
  quantity: "1"
});

// Safe number parser
const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Panel logic for one cabinet spec
 *
 * Matches your Excel logic:
 *
 * BoxHeight = CabinetHeight - KickHeight (if both provided),
 * otherwise we fall back to entered BoxHeight.
 *
 * Per ONE cabinet:
 *  - Walls (Left & Right): 2 pcs
 *      H = BoxHeight
 *      W = BoxDepth
 *
 *  - Floor: 1 pc
 *      H = BoxDepth
 *      W = BoxWidth - 0.75
 *
 *  - Back: 1 pc
 *      H = BoxHeight - 1.5
 *      W = BoxWidth - 0.75
 *
 *  - Braces (combined): 3 pcs
 *      H = BraceHeight
 *      W = BoxWidth - 1.5
 *
 * Then multiplied by Quantity.
 *
 * Each panel has: { label, width, height, count }
 */
const computePanelsForRow = (row) => {
  const cabinetHeight = parseNumber(row.cabinetHeight);
  const kickHeight = parseNumber(row.kickHeight);
  const boxWidth = parseNumber(row.boxWidth);
  const boxDepth = parseNumber(row.boxDepth);
  const braceHeight = parseNumber(row.braceHeight);
  const quantity = parseNumber(row.quantity);
  const boxHeightInput = parseNumber(row.boxHeight);

  // Derive BoxHeight like Excel if possible
  let boxHeightEffective = null;
  if (cabinetHeight != null && kickHeight != null) {
    boxHeightEffective = cabinetHeight - kickHeight;
  } else {
    boxHeightEffective = boxHeightInput;
  }

  // If key values missing or invalid, skip row
  if (
    boxHeightEffective == null ||
    boxWidth == null ||
    boxDepth == null ||
    braceHeight == null ||
    quantity == null ||
    quantity <= 0
  ) {
    return [];
  }

  const panels = [];

  // Walls (Left & Right) – 2 pcs
  panels.push({
    label: "Wall",
    width: boxDepth,
    height: boxHeightEffective,
    count: 2 * quantity
  });

  // Floor – 1 pc
  panels.push({
    label: "Floor",
    width: boxWidth - 0.75,
    height: boxDepth,
    count: 1 * quantity
  });

  // Back – 1 pc
  panels.push({
    label: "Back",
    width: boxWidth - 0.75,
    height: boxHeightEffective - 1.5,
    count: 1 * quantity
  });

  // Braces – 3 pcs
  panels.push({
    label: "Brace",
    width: boxWidth - 1.5,
    height: braceHeight,
    count: 3 * quantity
  });

  // Filter out non-positive dimensions or counts
  return panels.filter(
    (p) => p.width > 0 && p.height > 0 && p.count > 0
  );
};

/**
 * Aggregate panels over all rows.
 * Group by (label + width + height), and sum counts.
 */
const aggregatePanels = (rows) => {
  const map = new Map();

  rows.forEach((row) => {
    const panels = computePanelsForRow(row);
    panels.forEach((panel) => {
      const { label, width, height, count } = panel;
      const key = `${label}|${width}|${height}`;
      const existing = map.get(key) || {
        label,
        width,
        height,
        count: 0
      };
      existing.count += count;
      map.set(key, existing);
    });
  });

  // Return as sorted array for nice display
  const list = Array.from(map.values());
  list.sort((a, b) => {
    // Sort by label, then width, then height
    if (a.label < b.label) return -1;
    if (a.label > b.label) return 1;
    if (a.width !== b.width) return a.width - b.width;
    return a.height - b.height;
  });
  return list;
};

const App = () => {
  const [rows, setRows] = useState(() => [createEmptyRow(1)]);
  const [nextId, setNextId] = useState(2);

  const handleChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(nextId)]);
    setNextId((id) => id + 1);
  };

  const handleRemoveRow = (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const panelSummary = useMemo(
    () => aggregatePanels(rows),
    [rows]
  );

  const handleExportCSV = () => {
    if (!panelSummary.length) return;

    const header = "Label,Width,Height,Count";
    const lines = panelSummary.map((p) =>
      [p.label, p.width, p.height, p.count].join(",")
    );
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "cabinet-panels.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="960px" padding={4}>
      <View gap={4}>
        {/* Header */}
        <View gap={1}>
          <Text variant="featured-2" weight="bold">
            Cabinet Panel Calculator
          </Text>
          <Text variant="body-2" color="neutral-faded">
            Enter cabinet dimensions and quantity for each cabinet
            row. Panel sizes are calculated using your spreadsheet
            logic, and identical panels are tallied together.
          </Text>
        </View>

        {/* Cabinet rows */}
        <View gap={2}>
          <View
            direction="row"
            justify="space-between"
            align="center"
          >
            <Text variant="featured-4" weight="medium">
              Cabinets
            </Text>
            <Button
              onClick={handleAddRow}
              variant="solid"
              color="primary"
            >
              Add cabinet
            </Button>
          </View>

          <Table border columnBorder>
            <Table.Row>
              <Table.Heading>#</Table.Heading>
              <Table.Heading>Cabinet Height</Table.Heading>
              <Table.Heading>Kick Height</Table.Heading>
              <Table.Heading>Box Height</Table.Heading>
              <Table.Heading>Box Width</Table.Heading>
              <Table.Heading>Box Depth</Table.Heading>
              <Table.Heading>Brace Height</Table.Heading>
              <Table.Heading>Quantity</Table.Heading>
              <Table.Heading>Actions</Table.Heading>
            </Table.Row>

            {rows.map((row, index) => (
              <Table.Row key={row.id}>
                {/* Row index */}
                <Table.Cell>
                  <Text>{index + 1}</Text>
                </Table.Cell>

                {/* Cabinet Height */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Cab H
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.cabinetHeight}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "cabinetHeight",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Kick Height */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Kick H
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.kickHeight}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "kickHeight",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Box Height (optional override / display) */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Box H
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.boxHeight}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "boxHeight",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Box Width */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Box W
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.boxWidth}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "boxWidth",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Box Depth */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Depth
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.boxDepth}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "boxDepth",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Brace Height */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>
                      Brace H
                    </FormControl.Label>
                    <TextField
                      type="number"
                      value={row.braceHeight}
                      onChange={({ value }) =>
                        handleChange(
                          row.id,
                          "braceHeight",
                          value
                        )
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Quantity */}
                <Table.Cell>
                  <FormControl size="small">
                    <FormControl.Label>Qty</FormControl.Label>
                    <TextField
                      type="number"
                      value={row.quantity}
                      onChange={({ value }) =>
                        handleChange(row.id, "quantity", value)
                      }
                    />
                  </FormControl>
                </Table.Cell>

                {/* Actions */}
                <Table.Cell>
                  <Button
                    variant="ghost"
                    color="neutral"
                    onClick={() => handleRemoveRow(row.id)}
                    disabled={rows.length === 1}
                  >
                    Remove
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        </View>

        {/* Panel summary and CSV export */}
        <View gap={2}>
          <View
            direction="row"
            justify="space-between"
            align="center"
          >
            <Text variant="featured-4" weight="medium">
              Panel totals
            </Text>
            <Button
              variant="outline"
              color="primary"
              onClick={handleExportCSV}
              disabled={panelSummary.length === 0}
            >
              Download CSV
            </Button>
          </View>

          {panelSummary.length === 0 ? (
            <Text variant="body-2" color="neutral-faded">
              Enter valid dimensions and quantities to see panel
              requirements and export them as CSV.
            </Text>
          ) : (
            <Table border columnBorder>
              <Table.Row>
                <Table.Heading>Label</Table.Heading>
                <Table.Heading>Width</Table.Heading>
                <Table.Heading>Height</Table.Heading>
                <Table.Heading>Total count</Table.Heading>
              </Table.Row>
              {panelSummary.map((p, idx) => (
                <Table.Row key={`${p.label}-${idx}-${p.width}-${p.height}`}>
                  <Table.Cell>
                    <Text>{p.label}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{p.width}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{p.height}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{p.count}</Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          )}
        </View>
      </View>
    </Container>
  );
};

export default App;
