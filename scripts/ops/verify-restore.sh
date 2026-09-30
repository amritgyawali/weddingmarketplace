#!/usr/bin/env bash
# Compares a restored database with the row counts taken from the dump
# (dump-counts.awk). Prints a Markdown table and exits 1 on any difference.
#
#   scripts/ops/verify-restore.sh counts.tsv "<psql command prefix>"
#
# The psql prefix lets CI run the client that matches the server, e.g.
#   "docker run --rm --network host postgres:17 psql postgresql://postgres:postgres@127.0.0.1:54322/postgres"
set -euo pipefail

counts="$1"
psql_cmd="$2"

[ -s "$counts" ] || { echo "No counts in $counts"; exit 1; }

# One query for every table: select 'schema.table', count(*) from schema.table union all …
query=$(awk -F '\t' '{
  split($1, p, ".")
  printf "%sselect %c%s%c as t, count(*) as n from \"%s\".\"%s\"", (NR > 1 ? " union all " : ""), 39, $1, 39, p[1], p[2]
}' "$counts")

restored=$($psql_cmd -Atq -F $'\t' -v ON_ERROR_STOP=1 -c "$query order by 1")

echo "| Table | In the dump | Restored |"
echo "|---|---:|---:|"
bad=0
total=0
while IFS=$'\t' read -r table expected; do
  got=$(printf '%s\n' "$restored" | awk -F '\t' -v t="$table" '$1 == t { print $2 }')
  total=$((total + expected))
  if [ "$got" != "$expected" ]; then
    bad=$((bad + 1))
    echo "| **$table** | $expected | **${got:-missing}** |"
  elif [ "$expected" != "0" ]; then
    echo "| $table | $expected | $got |"
  fi
done < <(sort "$counts")

tables=$(wc -l < "$counts" | tr -d ' ')
echo
if [ "$bad" -eq 0 ]; then
  echo "Restore matches the dump: $tables tables, $total rows (empty tables not listed)."
else
  echo "$bad of $tables tables differ from the dump."
  exit 1
fi
