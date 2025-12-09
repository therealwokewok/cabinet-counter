import React, { useMemo, useState } from "react";
import {
  Container,
  View,
  Text,
  Button,
  Table,
  TextField,
  FormControl,
  Card,
  Divider,
} from "reshaped";

// Create a blank cabinet row
const createEmptyRow = (id) => ({
  id,
  label: "",
  cabinetHeight: "",
  kickHeight: "",
  boxHeight: "",
  boxWidth: "",
  boxDepth: "",
  braceHeight: "",
  quantity: "1",
});

// Parse numeric inputs safely
const parseNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

// Compute effective box height using your Excel logic
const getEffectiveBoxHeight = (row) => {
  const cabinetHeight = parseNumber(row.cabinetHeight);
  const kickHeight = parseNumber(row.kickHeight);
  const boxHeightInput = parseNumber(row.boxHeight);

  if (cabinetHeight != null && kickHeight != null) {
    return cabinetHeight - kickHeight;
  }
  return boxHeightInput;
};

/**
 * Panel logic for one cabinet spec
 *
 * Matches your spreadsheet:
 *
 * BoxHeight = CabinetHeight - KickHeight (if both provided),
 * otherwise uses entered BoxHeight.
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
 */
const computePanelsForRow = (row) => {
  const boxHeightEffective = getEffectiveBoxHeight(row);
  const boxWidth = parseNumber(row.boxWidth);
  const boxDepth = parseNumber(row.boxDepth);
  const braceHeight = parseNumber(row.braceHeight);
  const quantity = parseNumber(row.quantity);

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
    count: 2 * quantity,
  });

  // Floor – 1 pc
  panels.push({
    label: "Floor",
    width: boxWidth - 0.75,
    height: boxDepth,
    count: 1 * quantity,
  });

  // Back – 1 pc
  panels.push({
    label: "Back",
    width: boxWidth - 0.75,
    height: boxHeightEffective - 1.5,
    count: 1 * quantity,
  });

  // Braces – 3 pcs
  panels.push({
    label: "Brace",
    width: boxWidth - 1.5,
    height: braceHeight,
    count: 3 * quantity,
  });

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
        count: 0,
      };
      existing.count += count;
      map.set(key, existing);
    });
  });

  const list = Array.from(map.values());
  list.sort((a, b) => {
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

  const handleDuplicateRow = (row) => {
    setRows((prev) => [
      ...prev,
      {
        ...row,
        id: nextId,
      },
    ]);
    setNextId((id) => id + 1);
  };

  const handleReset = () => {
    setRows([createEmptyRow(1)]);
    setNextId(2);
  };

  const handleLoadExample = () => {
    const exampleRows = [
      {
        id: 1,
        label: "Base 30\"",
        cabinetHeight: "34.5",
        kickHeight: "4.5",
        boxHeight: "",
        boxWidth: "30",
        boxDepth: "24",
        braceHeight: "3",
        quantity: "4",
      },
      {
        id: 2,
        label: "Upper 30\"",
        cabinetHeight: "30",
        kickHeight: "0",
        boxHeight: "",
        boxWidth: "30",
        boxDepth: "12",
        braceHeight: "3",
        quantity: "6",
      },
    ];
    setRows(exampleRows);
    setNextId(3);
  };

  const panelSummary = useMemo(
    () => aggregatePanels(rows),
    [rows]
  );

  const totalPanels = useMemo(
    () => panelSummary.reduce((sum, p) => sum + p.count, 0),
    [panelSummary]
  );

  const handleExportCSV = () => {
    if (!panelSummary.length) return;

    const header = "Label,Width,Height,Count";
    const lines = panelSummary.map((p) =>
      [p.label, p.width, p.height, p.count].join(",")
    );
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
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
    <View
      backgroundColor="neutral-faded"
      minHeight="100vh"
      paddingBlock={8}
    >
      <Container maxWidth="1120px">
        <Card elevated padding={5}>
          <View gap={4}>
            {/* Top bar */}
            <View
              direction={{ s: "column", m: "row" }}
              justify="space-between"
              align={{ s: "stretch", m: "center" }}
              gap={3}
            >
              <View gap={0.5}>
                <Text variant="featured-1" weight="bold">
                  Cabinet Panel Calculator
                </Text>
                <Text variant="body-2" color="neutral-faded">
                  Enter cabinet styles and quantities. The app
                  calculates a consolidated cut-list using your
                  spreadsheet’s panel logic.
                </Text>
              </View>

              <View
                direction="row"
                justify={{ s: "flex-start", m: "flex-end" }}
                gap={2}
              >
                <Button
                  variant="outline"
                  color="neutral"
                  onClick={handleReset}
                >
                  Reset
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleLoadExample}
                >
                  Load example
                </Button>
              </View>
            </View>

            <Divider />

            {/* Main content: specs + totals */}
            <View
              gap={6}
              direction={{ s: "column", m: "row" }}
              align="stretch"
            >
              {/* Left: cabinet table */}
              <View.Item grow>
                <View gap={3}>
                  <View
                    direction="row"
                    justify="space-between"
                    align="center"
                    wrap
                    gap={2}
                  >
                    <View gap={0.5}>
                      <Text
                        variant="featured-4"
                        weight="medium"
                      >
                        Cabinet specs
                      </Text>
                      <Text
                        variant="caption-1"
                        color="neutral-faded"
                      >
                        Each row is a cabinet style. Quantities are
                        multiplied into the final cut-list.
                      </Text>
                    </View>
                    <Button
                      onClick={handleAddRow}
                      variant="solid"
                      color="primary"
                      size="medium"
                    >
                      Add cabinet
                    </Button>
                  </View>

                  <View
                    borderColor="neutral-faded"
                    borderRadius="large"
                    borderWidth={1}
                    overflow="hidden"
                  >
                    <Table border columnBorder>
                      <Table.Row highlighted>
                        <Table.Heading>#</Table.Heading>
                        <Table.Heading>Label</Table.Heading>
                        <Table.Heading>Cab H</Table.Heading>
                        <Table.Heading>Kick H</Table.Heading>
                        <Table.Heading>Box H</Table.Heading>
                        <Table.Heading>Box W</Table.Heading>
                        <Table.Heading>Depth</Table.Heading>
                        <Table.Heading>Brace H</Table.Heading>
                        <Table.Heading>Qty</Table.Heading>
                        <Table.Heading />
                      </Table.Row>

                      {rows.map((row, index) => {
                        const boxHeightEff =
                          getEffectiveBoxHeight(row);
                        const hasDerived =
                          parseNumber(row.cabinetHeight) !=
                            null &&
                          parseNumber(row.kickHeight) != null;

                        return (
                          <Table.Row key={row.id}>
                            {/* Index */}
                            <Table.Cell>
                              <Text variant="body-3">
                                {index + 1}
                              </Text>
                            </Table.Cell>

                            {/* Label */}
                            <Table.Cell>
                              <FormControl size="small">
                                <FormControl.Label>
                                  Name
                                </FormControl.Label>
                                <TextField
                                  placeholder="Base 30&quot; / Sink / Pantry…"
                                  size="small"
                                  value={row.label}
                                  onChange={({ value }) =>
                                    handleChange(
                                      row.id,
                                      "label",
                                      value
                                    )
                                  }
                                />
                              </FormControl>
                            </Table.Cell>

                            {/* Cabinet Height */}
                            <Table.Cell>
                              <FormControl size="small">
                                <FormControl.Label>
                                  Cab H
                                </FormControl.Label>
                                <TextField
                                  type="number"
                                  placeholder="34.5"
                                  suffix="in"
                                  size="small"
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
                                  placeholder="4.5"
                                  suffix="in"
                                  size="small"
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

                            {/* Box Height (with derived hint) */}
                            <Table.Cell>
                              <FormControl size="small">
                                <FormControl.Label>
                                  Box H
                                  {hasDerived &&
                                    boxHeightEff != null && (
                                      <Text
                                        as="span"
                                        variant="caption-2"
                                        color="neutral-faded"
                                      >
                                        {" "}
                                        (auto: {boxHeightEff})
                                      </Text>
                                    )}
                                </FormControl.Label>
                                <TextField
                                  type="number"
                                  placeholder="optional"
                                  suffix="in"
                                  size="small"
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
                                  placeholder="30"
                                  suffix="in"
                                  size="small"
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
                                  placeholder="24"
                                  suffix="in"
                                  size="small"
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
                                  placeholder="3"
                                  suffix="in"
                                  size="small"
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
                                <FormControl.Label>
                                  Qty
                                </FormControl.Label>
                                <TextField
                                  type="number"
                                  placeholder="1"
                                  size="small"
                                  value={row.quantity}
                                  onChange={({ value }) =>
                                    handleChange(
                                      row.id,
                                      "quantity",
                                      value
                                    )
                                  }
                                />
                              </FormControl>
                            </Table.Cell>

                            {/* Actions */}
                            <Table.Cell>
                              <View
                                direction="row"
                                gap={1}
                                justify="flex-end"
                              >
                                <Button
                                  variant="ghost"
                                  color="neutral"
                                  size="small"
                                  onClick={() =>
                                    handleDuplicateRow(row)
                                  }
                                >
                                  Copy
                                </Button>
                                <Button
                                  variant="ghost"
                                  color="neutral"
                                  size="small"
                                  onClick={() =>
                                    handleRemoveRow(row.id)
                                  }
                                  disabled={rows.length === 1}
                                >
                                  Remove
                                </Button>
                              </View>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table>
                  </View>
                </View>
              </View.Item>

              {/* Right: panel totals */}
              <View width={{ s: "100%", m: "38%" }} gap={3}>
                <View
                  direction="row"
                  justify="space-between"
                  align="center"
                  gap={2}
                >
                  <View gap={0.5}>
                    <Text
                      variant="featured-4"
                      weight="medium"
                    >
                      Panel totals
                    </Text>
                    <Text
                      variant="caption-1"
                      color="neutral-faded"
                    >
                      Grouped by label and size. Updates live as
                      you edit.
                    </Text>
                  </View>

                  <Button
                    variant="outline"
                    color="primary"
                    size="small"
                    onClick={handleExportCSV}
                    disabled={panelSummary.length === 0}
                  >
                    Download CSV
                  </Button>
                </View>

                <Card
                  padding={3}
                  backgroundColor="neutral-faded"
                >
                  {panelSummary.length === 0 ? (
                    <View gap={2}>
                      <Text
                        variant="body-2"
                        color="neutral-faded"
                      >
                        Start by adding at least one cabinet style
                        with dimensions and quantity. Panel totals
                        will appear here.
                      </Text>
                    </View>
                  ) : (
                    <View gap={3}>
                      <View
                        direction="row"
                        justify="space-between"
                        align="center"
                      >
                        <View gap={0.5}>
                          <Text
                            variant="caption-1"
                            color="neutral-faded"
                          >
                            Total panels
                          </Text>
                          <Text
                            variant="featured-4"
                            weight="bold"
                          >
                            {totalPanels}
                          </Text>
                        </View>
                        <View gap={0.5} align="end">
                          <Text
                            variant="caption-1"
                            color="neutral-faded"
                          >
                            Panel types
                          </Text>
                          <Text
                            variant="featured-4"
                            weight="bold"
                          >
                            {panelSummary.length}
                          </Text>
                        </View>
                      </View>

                      <View
                        borderRadius="medium"
                        borderColor="neutral-faded"
                        borderWidth={1}
                        overflow="hidden"
                      >
                        <Table border columnBorder>
                          <Table.Row highlighted>
                            <Table.Heading>
                              Label
                            </Table.Heading>
                            <Table.Heading>
                              Width
                            </Table.Heading>
                            <Table.Heading>
                              Height
                            </Table.Heading>
                            <Table.Heading>
                              Count
                            </Table.Heading>
                          </Table.Row>
                          {panelSummary.map((p, idx) => (
                            <Table.Row
                              key={`${p.label}-${idx}-${p.width}-${p.height}`}
                            >
                              <Table.Cell>
                                <Text variant="body-3">
                                  {p.label}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text variant="body-3">
                                  {p.width}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text variant="body-3">
                                  {p.height}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text variant="body-3">
                                  {p.count}
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table>
                      </View>
                    </View>
                  )}
                </Card>
              </View>
            </View>
          </View>
        </Card>
      </Container>
    </View>
  );
};

export default App;
