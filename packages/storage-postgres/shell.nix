# shell.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    postgresql_15
    nodejs_20
  ];

  shellHook = ''
    # Set PostgreSQL data directory
    export PGDATA="$PWD/.postgres"
    export POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/hypha"

    # Function to stop PostgreSQL
    pg_stop() {
      if pg_ctl status -D "$PGDATA"; then
        echo "Stopping PostgreSQL..."
        pg_ctl stop -D "$PGDATA"
      else
        echo "PostgreSQL is not running"
      fi
    }

    # Initialize PostgreSQL if data directory doesn't exist
    if [ ! -d "$PGDATA" ]; then
      initdb -D "$PGDATA" --auth=trust --no-locale --encoding=UTF8 --username=postgres
      # Configure PostgreSQL to listen on port 5432
      echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
      echo "port = 5432" >> "$PGDATA/postgresql.conf"
      echo "host all all 0.0.0.0/0 trust" >> "$PGDATA/pg_hba.conf"
    fi

    # Start PostgreSQL in background if not already running
    if ! pg_ctl status -D "$PGDATA"; then
      pg_ctl start -D "$PGDATA" -l "$PGDATA/postgresql.log"

      # Wait for PostgreSQL to start
      until pg_isready -q; do
        echo "Waiting for PostgreSQL to start..."
        sleep 1
      done

      # Create postgres superuser if it doesn't exist
      if ! psql -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1; then
        createuser -s postgres
      fi

      # Create database if it doesn't exist
      if ! psql -U postgres -lqt | cut -d \| -f 1 | grep -qw hypha; then
        createdb -U postgres hypha
      fi
    fi

    echo "PostgreSQL is running on port 5432"
    echo "Database URL: $POSTGRES_URL"
    echo ""
    echo "Available commands:"
    echo "  pg_stop    - Stop the PostgreSQL server"
    echo "  pg_ctl     - PostgreSQL server control utility"
    echo "  psql       - PostgreSQL interactive terminal"
  '';
}
