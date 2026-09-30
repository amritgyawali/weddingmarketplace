# Rows per table in a plain-SQL data dump made with COPY (supabase db dump
# --data-only --use-copy): prints "schema.table<TAB>rows", one line per table.
# The backup stores this next to the dump, and the restore rehearsal checks the
# restored database has exactly these counts.
#
#   awk -f scripts/ops/dump-counts.awk data.sql > counts.tsv
/^COPY / {
  table = $2
  gsub(/"/, "", table)
  rows = 0
  inside = 1
  next
}
inside && /^\\.$/ {
  print table "\t" rows
  inside = 0
  next
}
inside { rows++ }
