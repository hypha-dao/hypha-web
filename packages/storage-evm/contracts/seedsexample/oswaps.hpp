#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>
#include <eosio/transaction.hpp>
#include <algorithm>

using namespace eosio;
using std::string;
   /**
    * The `oswaps` contract implements a token conversion service ("currency exchange") based on a
    *   multilateral token pool using the "balancer" invariant. The contract uses a "single sided"
    *   liquidity investment model in which balancer weights are adjusted during liquidity
    *   changes. These fundamental functions are supported :
    *   - add liquidity, e.g. insert some Token A into the pool
    *   - withdraw liquidity, e.g. extract some Token A from the pool
    *   - convert, e.g. change token A to Token B, delivered to a recipient
    * The initial `oswaps` implementation is a Proof of Concept and lacks some functions
    *   including
    *   - exchange fees
    *   - liquidity metering
    *   - multichain operation
    *
    * Transfers into the oswaps contract proceed via a compound transaction containing two actions
    *   In the first action, the originator submits transaction details in a "prep" action
    *   In the second action, the originator sends an ordinary token transfer action to the contract.
    *     The transfer triggers an "on-notify" routine which accesses the fields in the "prep"
    *     action call, which must immediately precede the transfer in a compound transaction.
    *   These two actions must be next-to-last and last action of the transaction, respectively.
    *
    * The contract anticipates a future ability to operate across different chains, with
    *   varying conventions for token identification. Therefore token identities are
    *   recorded in a table and a numerical code from that table is used in action fields.
    *   (Typically a redundant action field with the symbol string is also present,
    *   to minimize errors in manually-entered transaction data.)
    *   Initially the contract supports Antelope chains and registers tokens
    *   referencing a 4-tuple < family, chain, contract, symbol > where family is
    *   "antelope".
    *
    * The contract supports an asset table with one row for each recognized token.
    *   The parameter set serves the Proof of Concept.
    *   Future expansion TBD, may involve adding new fields to the asset table or
    *   adding a supplementary table.
    *
    * Authorization model
    * The contract account owner permission should be a "cold" multisig which is used once for
    *   uploading the contract and once for specifying a manager account. It has no
    *   operational role after that, however for test purposes the `reset` action is
    *   implemented.
    *   For any token having transfer rights restricted to whitelisted accounts, the contract
    *   account must be added to the token's whitelist.
    * The manager account will typically be under some sort type of governance control (e.g. DAO).
    *   This account can freeze and unfreeze transaction processing on a per-token basis. The
    *   manager account may transfer authority to a replacement manager account.
    * By placing named authorizations in the asset table, this facility may be used to
    *   assign per-token management powers, but the details are TBD and beyond the PoC.    
    */

CONTRACT oswaps : public contract {
  public:
      using contract::contract;

      /**
          * The `reset` action executed by the oswaps contract account deletes all table data
      */
      ACTION reset();
 
      /**
          * This action clears the `accounts` table for a particular account. All
          * token balances in the account are erased.
          *
          * @param account - account
          *
          * @pre Transaction must have the contract account owner authority 
          */
         ACTION resetacct( const name& account );

      /**
          * The one-time `init` action executed by the oswaps contract account records
          *  the manager account and chain identifier
          *
          * @param manager - an account empowered to execute freeze and setparameter actions
          * @param chain - a well-known name or hex-encoded chain_id
      */
      ACTION init(name manager, string chain);
      
      /**
          * The `freeze` action executed by the manager or other authorized actor suspends
          * transactions in a specified token
          *
          * @param actor - an account empowered to execute the freeze action
          * @param token_id - a numerical token identifier in the asset table
          * @param symbol - the symbol of the affected token
      */
      ACTION freeze(name actor, uint64_t token_id, string symbol);

      /**
          * The `unfreeze` action executed by the manager or other authorized actor enables
          * transactions in a specified token
          *
          * @param actor - an account empowered to execute the freeze action
          * @param token_id - a numerical token identifier in the asset table
          * @param symbol - the symbol of the affected token
      */
      ACTION unfreeze(name actor, uint64_t token_id, string symbol);
      

    typedef struct statusEntry {
      uint64_t token_id;
      asset balance;
      float weight;
    } statusEntry;
    typedef struct poolStatus {
      std::vector<statusEntry> status_entries;
    } poolStatus;
    
      /**
          * The `querypool` action returns an array reporting on the balances and
          *   weights in the pool. This informations is intended to enable the caller
          *   to compute the exchange rate for an upcoming transaction.
          *
          * @param token_id_list - an array of numerical token identifiers 
      */
      [[eosio::action, eosio::read_only]] oswaps::poolStatus querypool(std::vector<uint64_t> token_id_list);

      /**
          * The `createasseta` creates an entry in the asset table for an
          *   antelope family token. It also creates a liquidity pool token
          *   LIQxx which will be issued in exchange for additions.
          *   TBD: how to record IBC wrapped token contracts
          *
          * @param actor - an account empowered to set the specified parameter
          * @param chain - the "home chain" of a token, expressed as a common name
          *                  followed by ';' and a hex chain id
          * @param contract - the contract name
          * @param symbol - the symbol of the affected token
          * @param meta - metadata (JSON) 
          *
          * @result - the token_id for this asset
      */
      ACTION createasseta(
              name actor, string chain, name contract, symbol_code symbol, string meta);

      /**
          * The `forgetasset` action removes an entry in the asset table. This does
          * not affect any token balance held by the contract.
          *
          * @param actor - an account empowered remove the asset (manager account)
          * @param token_id - a numerical token identifier in the asset table
          * @param memo
      */
      ACTION forgetasset(name actor, uint64_t token_id, string memo);

      /**
          * The `withdraw` action withdraws liquidity while simultaneously
          *   adjusting weight-fractions in the balancer invariant formula
          * If the weight parameter is zero, a new weight will be computed
          * which leaves the exchange rate unchanged. If the parameter is non-zero,
          * (i.e. price is being changed) the token will be frozen until it is
          * re-activated by the manager with an unfreeze action.
          * [future: Token transfers occur through a rate-throttling queue which may
          *    introduce delays]
          * 
          * @param account - the account receiving the tokens
          * @param token_id - a numerical token identifier in the asset table
          * @param amount - the amount of asset (quantity, symbol) to withdraw from pool;
          * @param weight - the new balancer weight (or zero)
      */
      ACTION withdraw(name account, uint64_t token_id, string amount, float weight);

      /**
          * The `addliqprep` action adds liquidity while simultaneously
          *   adjusting weight-fractions in the balancer invariant formula
          * If the weight parameter is zero, a new weight will be computed
          * which leaves the exchange rate unchanged. If the parameter is non-zero,
          * (i.e. price is being changed) the token will be frozen until it is
          * re-activated by the manager with an unfreeze action.
          * [future: Token transfers occur through a rate-throttling queue which may
          *    introduce delays]
          * 
          * @param account - the account sourcing the tokens
          * @param token_id - a numerical token identifier in the asset table
          * @param amount - the amount of asset (quantity, symbol) to add to pool;
          * @param weight - the new balancer weight (or zero)
      */
      ACTION addliqprep(name account, uint64_t token_id,
                        string amount, float weight);

      /**
          * The `exprepfrom` and `exprepto` actions are functions describing a conversion
          *   ("currency exchange") transaction, taking a quantity of tokens from the sender
          *   and delivering a corresponding quantity of a different token to the recipient. 
          * The conversion ratio ("exchange rate") is computed according to a multilateral
          *   "balancer" type algorithm with an invariant V
          *     V = B1**W1 * B2**W2 * ... * Bn**Wn
          *   and therefore depends dynamically on the pool balances B. In the small-
          *   transaction limit (no "slippage"), and with zero fees, an input of
          *   Qi tokens of type i will emit Qj = Qi * (Bj/Bi)*(Wi/Wj) tokens of type j.
          *
          * In the `exprepfrom` action call, the incoming amount is specified and the outgoing
          *   amount is to be computed by the contract.
          * 
          * 
          * @param sender - the account sourcing tokens to the transaction
          * @param recipient - the account receiving tokens from the transaction
          * @param in_token_id - a numerical token identifierfor the incoming asset
          * @param out_token_id - a numerical token identifier for the outgoing asset
          * @param in_amount - the incoming amount (quantity, symbol) 
          * @param memo
          *
          *
      */
      ACTION exprepfrom(
           name sender, name recipient, uint64_t in_token_id, uint64_t out_token_id,
           string in_amount, string memo);

      /**
          * In the `exprepto` action call, the outgoing amount is specified and the incoming
          *   amount is to be computed by the contract.
          * 
          * @param sender - the account sourcing tokens to the transaction
          * @param recipient - the account receiving tokens from the transaction
          * @param in_token_id - a numerical token identifierfor the incoming asset
          * @param out_token_id - a numerical token identifier for the outgoing asset
          * @param out_amount - the outgoing amount (quantity, symbol)
          * @param memo
          *
      */
      ACTION exprepto(
           name sender, name recipient, uint64_t in_token_id, uint64_t out_token_id,
           string out_amount, string memo);

           
      /**
          * Allows `from` account to transfer to `to` account the `quantity` tokens
          * issued under this contract (e.g. LIQxx tokens). One account is debited and
          * the other is credited with quantity tokens.
          *
          * @param from - the account to transfer from,
          * @param to - the account to be transferred to,
          * @param quantity - the quantity of tokens to be transferred,
          * @param memo - the memo string to accompany the transaction.
          */
         ACTION transfer( const name&    from,
                               const name&    to,
                               const asset&   quantity,
                               const string&  memo );

         /**
          * The opposite of a create action, if all validations succeed,
          * it debits the statstable.supply amount.
          *
          * @param quantity - the quantity of tokens to retire,
          * @param memo - the memo string to accompany the transaction.
          */
         ACTION retire( const asset& quantity, const string& memo );  

      /**
          * The `ontransfer` action is called whenever any token is transferred to
          * or from the oswaps contract. (The call is initiated by the 
          * `require-recipient` function in the token contract.)
          *
          * This action inspects the transaction in which the transfer action
          *   was embedded. There should be an immediately preceding action
          *   specifying the intended consequence of this token transfer
          *   (e.g. add liquidity, swap, ...)
          * If no recognized action preceded the transfer, the token is
          *   transferred into the contract account's balance.
          *
          * @param from - token sender
          * @param to - token recipient
          * @param quantity - the quantity transferred (amount and symbol)
          * @param memo
      */
      [[eosio::on_notify("*::transfer")]]
      void ontransfer(name from, name to, eosio::asset quantity, string memo);

    

    
    struct addliqprep_params {
      name account;
      uint64_t token_id;
      string amount;
      float weight;
      EOSLIB_SERIALIZE( addliqprep_params, (account)(token_id)(amount)(weight) )
    };
    struct exprepfrom_params {
      name sender;
      name recipient;
      uint64_t in_token_id;
      uint64_t out_token_id;
      string in_amount;
      string memo;
      EOSLIB_SERIALIZE( exprepfrom_params,
        (sender)(recipient)(in_token_id)(out_token_id)(in_amount)(memo) )
    };
    struct exprepto_params {
      name sender;
      name recipient;
      uint64_t in_token_id;
      uint64_t out_token_id;
      string out_amount;
      string memo;
      EOSLIB_SERIALIZE( exprepto_params,
        (sender)(recipient)(in_token_id)(out_token_id)(out_amount)(memo) )

    };
    struct transfer_params {
      name from;
      name to;
      asset quantity;
      string memo;
      EOSLIB_SERIALIZE( transfer_params, (from)(to)(quantity)(memo) )
    };

  private:

      /********** standard token-contract tables ***********/
      TABLE account { // scoped on account name
        asset    balance;
        uint64_t primary_key()const { return balance.symbol.code().raw(); }
      };
      TABLE currency_stats {  // scoped on token symbol code
        asset    supply;
        asset    max_supply;
        name     issuer;
        uint64_t primary_key()const { return supply.symbol.code().raw(); }
      };
      typedef eosio::multi_index< "accounts"_n, account > accounts;
      typedef eosio::multi_index< "stat"_n, currency_stats > stats;
      /**************/

      
      // config
      TABLE config { // singleton, scoped by contract account name
        name manager;
        checksum256 chain_id;
        uint64_t last_token_id;
        bool withdraw_flag;
      } config_row;

      // types of antelope tokens
      TABLE assettypea { // single table, scoped by contract account name
        uint64_t token_id;
        checksum256 chain_code;
        name contract_name;
        symbol_code symbol;
        bool active;
        string metadata;
        float weight;
        
        uint64_t primary_key() const { return token_id; }
        checksum256 by_chain() const { return chain_code; }
      };
     
      // for transient storage of prep action for immediately following transfer
      TABLE txtemp { // singleton, scoped by contract account name
        std::string txdata;

        //uint64_t primary_key() const { return 0; } // single row
      };

      typedef eosio::singleton< "configs"_n, config > configs;
      typedef eosio::multi_index<"assetsa"_n, assettypea, indexed_by
               < "bychain"_n,
                 const_mem_fun<assettypea, checksum256, &assettypea::by_chain > >
               > assetsa;
      typedef eosio::singleton< "tx"_n, txtemp >  txx;

      void sub_balance( const name& owner, const asset& value );
      void add_balance( const name& owner, const asset& value, const name& ram_payer );
      void save_transaction(name entry, uint64_t token_id);
};

