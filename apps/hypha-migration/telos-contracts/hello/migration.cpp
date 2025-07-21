#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>
using namespace eosio;

class [[eosio::contract]] migration : public contract {
  public:
    using contract::contract;

    // Table structure for migration data
    struct [[eosio::table]] migrationentry {
      name account;
      asset amount;
      std::string eth_address;
      bool migrated;
      uint64_t timestamp;

      uint64_t primary_key() const { return account.value; }
    };

    using migration_table = eosio::multi_index<"migrations"_n, migrationentry>;

    // Action to populate the migration table (admin only)
    [[eosio::action]]
    void populate(const std::vector<name>& accounts, const std::vector<asset>& amounts) {
      require_auth(get_self());
      
      check(accounts.size() == amounts.size(), "Accounts and amounts vectors must be the same size");
      
      migration_table migrations(get_self(), get_self().value);
      
      for (size_t i = 0; i < accounts.size(); i++) {
        auto itr = migrations.find(accounts[i].value);
        if (itr == migrations.end()) {
          migrations.emplace(get_self(), [&](auto& row) {
            row.account = accounts[i];
            row.amount = amounts[i];
            row.eth_address = "";
            row.migrated = false;
            row.timestamp = 0;
          });
        }
      }
    }

    // Main migration action
    [[eosio::action]]
    void migrate(name user, const std::string& eth_address) {
      require_auth(user);
      
      // Validate ethereum address format (basic validation)
      check(!eth_address.empty(), "Ethereum address cannot be empty");
      check(eth_address.length() == 42, "Invalid ethereum address length");
      check(eth_address.substr(0, 2) == "0x" || eth_address.substr(0, 2) == "0X", 
            "Ethereum address must start with 0x");
      
      migration_table migrations(get_self(), get_self().value);
      auto itr = migrations.find(user.value);
      
      // Check if user is whitelisted
      check(itr != migrations.end(), "User is not whitelisted for migration");
      
      // Check if already migrated
      check(!itr->migrated, "User has already migrated");
      
      // Update migration status
      migrations.modify(itr, user, [&](auto& row) {
        row.eth_address = eth_address;
        row.migrated = true;
        row.timestamp = current_time_point().sec_since_epoch();
      });
    }

    // Admin action to clear table (for testing)
    [[eosio::action]]
    void clear() {
      require_auth(get_self());
      migration_table migrations(get_self(), get_self().value);
      auto itr = migrations.begin();
      while (itr != migrations.end()) {
        itr = migrations.erase(itr);
      }
    }
}; 