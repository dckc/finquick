// @ts-check

const csvParse = (txt, skip = 0) => {
  const rows = [];
  let row = [];
  while (txt.length > 0) {
    const parts = txt.match(/^(?<cell>(?:[^",\r\n]|"[^"]*")*)(?<sep>,|\r?\n)/m);
    if (!parts) break;
    const raw = parts.groups.cell;
    const unq = raw.startsWith('"') ? raw.slice(1, -1) : raw;
    row.push(unq);
    if (parts.groups.sep !== ",") {
      if (skip > 0) {
        skip -= 1;
      } else {
        rows.push(row);
      }
      row = [];
    }
    txt = txt.slice(parts[0].length);
  }

  if (row.length > 0) {
    rows.push(row);
  }
  return rows;
};

/**
 * @param {Element} summarySection
 * @param {Object} io
 * @param {(tag: string, attrs: Record<string, string>, children: (Element|string)[]) => Element} io.elt
 */
const makeReportTool = (summarySection, { elt }) => {
  /**
   * @param {string[][]} rows
   */
  const fill = (rows) => {
    // summarySection.appendChild();
    console.log("@@", rows.slice(0, 3));
    const [hd, ...body] = rows;
    const table = elt("table", {}, [
      elt("thead", {}, [
        elt(
          "tr",
          {},
          hd.map((txt) => elt("th", {}, [txt]))
        ),
      ]),
      elt(
        "tbody",
        {},
        body.map((row) =>
          elt(
            "tr",
            {},
            row.map((txt) => elt("td", {}, [txt]))
          )
        )
      ),
    ]);
    summarySection.appendChild(table);
  };
  const handler = (ev) => {
    console.log("@@@handler", ev);
    const [file] = ev.target?.files;
    if (!file) {
      console.warn("no file?!");
      return;
    }
    const fr = new FileReader();
    fr.addEventListener("load", () => {
      const txt =
        typeof fr.result === "string"
          ? fr.result
          : die(`expected string; got: ${fr.result}`);
      console.log({ txt: txt.slice(0, 80) });
      fill(csvParse(txt, 7));
    });
    fr.readAsText(file);
  };
  return { handler };
};

/**
 *
 * @param {Object} io
 * @param {(sel: string) => Element} io.$
 * @param {(tag: string) => Element} io.createElement
 * @param {(tag: string) => Text} io.createTextNode
 */
export const run = ({ $, createElement, createTextNode }) => {
  console.log("@@run");

  /**
   *
   * @param {string} tag
   * @param {Record<string, string>} attrs
   * @param {(Element|string)[]} children
   */
  const elt = (tag, attrs = {}, children = []) => {
    const it = createElement(tag);
    Object.entries(attrs).forEach(([name, value]) =>
      it.setAttribute(name, value)
    );
    children.forEach((ch) => {
      if (typeof ch === "string") {
        it.appendChild(createTextNode(ch));
      } else {
        it.appendChild(ch);
      }
    });
    return it;
  };
  const tool = makeReportTool($("#summary"), { elt });
  $('input[name="report"]').addEventListener("change", tool.handler);
};
