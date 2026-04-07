#include "oswaps.hpp"
#include <../capi/eosio/action.h>

//contractName:oswaps

const checksum256 telos_chain_id = checksum256::make_from_word_sequence<uint64_t>(
  0x4667b205c6838ef7u,
  0x0ff7988f6e8257e8u,
  0xbe0e1284a2f59699u,
  0x054a018f743b1d11u );

uint64_t amount_from(symbol sym, string qty) { 
  int sp = qty.find(' ');
  check(sym.code().to_string() == qty.substr(sp+1), "mismatched symbol");
  size_t dp;
  uint64_t rv = std::stol(qty, &dp)*pow(10,sym.precision());
  if(qty.at(dp)=='.') {
    uint64_t f = std::stol(qty.substr(dp+1));
    int decimals = sp-dp-1;
    check(decimals <= sym.precision(), "too many decimals");
    for(int i=decimals; i<sym.precision(); ++i) {
      f *= 10;
    }
    rv += f;
  }
  return rv;
}

string sym_from_id(uint64_t token_id, string prefix) {
  if (token_id < 26) {
    return prefix + string(1, 'A' + token_id);
  } else {
    prefix = sym_from_id(token_id/26 - 1, prefix);
    return sym_from_id(token_id%26, prefix);
  }
}

void oswaps::save_transaction(name entry, uint64_t token_id) {
  auto size = transaction_size();
  //printf("saved tx, size %ld ", size);
  char *   buffer = (char *)(512 < size ? malloc(size) : alloca(size));
  uint32_t read   = read_transaction(buffer, size);
  check(size == read, "read_transaction failed");
  transaction trx = unpack<transaction>(buffer, size);  
  // validation on trx.actions
  //   check that the last action transfers the right token to oswaps
  //   check that the next-to-last action is oswaps `entry` action
  assetsa assettable(get_self(), get_self().value);
  auto a = assettable.require_find(token_id, "unrecog token id");  
  auto final_action = trx.actions.back();
  check(final_action.name == "transfer"_n,
    "final action must be token transfer");
  transfer_params tp = unpack<transfer_params>(final_action.data.data(), final_action.data.size());
  check(tp.to==get_self() && tp.quantity.symbol.code()==a->symbol
    && final_action.account == a->contract_name,
    "token transfer parameters don't match prep");
  action should_be_this_action = *(trx.actions.rbegin()+1);
  check(should_be_this_action.name == entry
    && should_be_this_action.account == get_self(),
    "prep action must be next-to-last in transaction ");
  // save serialized transaction to txx singleton
  std::string data(buffer, size);
  txx txset(get_self(), get_self().value);
  if (txset.exists()) {
    print("replacing unexpected saved transaction");
  }  
  txtemp tx;
  tx.txdata = data;
  txset.set(tx, get_self());
  return;

}
  
void oswaps::reset() {
  require_auth2(get_self().value, "owner"_n.value);
  {
    assetsa tbl(get_self(), get_self().value);
    auto itr = tbl.begin();
    while (itr != tbl.end()) {
      itr = tbl.erase(itr);
    }
    // TODO destroy LIQ tokens
  }
  configs configset(get_self(), get_self().value);
  if(configset.exists()) { configset.remove(); }
}

void oswaps::resetacct( const name& account )
{
  require_auth2( get_self().value, "owner"_n.value );
    accounts tbl(get_self(),account.value);
    auto itr = tbl.begin();
    while (itr != tbl.end()) {
      itr = tbl.erase(itr);
    }
}

void oswaps::init(name manager, string chain) {
  configs configset(get_self(), get_self().value);
  bool reconfig = configset.exists();
  auto cfg = configset.get_or_create(get_self(), config_row);
  if(reconfig) {
    require_auth(cfg.manager);
  } else {
    require_auth2(get_self().value, "owner"_n.value);
  }
  // TODO parse chain into chain_name, chain_code
  string chain_name = "Telos";
  checksum256 chain_code = telos_chain_id;
  check(chain == chain_name, "currently only Telos chain supported");
  check(chain.size() <= 100, "chain name too long");
  cfg.chain_id = chain_code;
  cfg.manager = manager;
  configset.set(cfg, get_self());
}

void oswaps::freeze(name actor, uint64_t token_id, string symbol) {
  configs configset(get_self(), get_self().value);
  check(configset.exists(), "not configured.");
  auto cfg = configset.get();
  check(actor == cfg.manager, "must be manager");
  require_auth(actor);
  assetsa assettable(get_self(), get_self().value);
  auto a = assettable.require_find(token_id, "unrecog token id");
  check(a->symbol == symbol_code(symbol), "mismatched symbol");
  assettable.modify( a, same_payer, [&]( auto& s ) {
    s.active = false;
  });
}

void oswaps::unfreeze(name actor, uint64_t token_id, string symbol) {
  configs configset(get_self(), get_self().value);
  check(configset.exists(), "not configured.");
  auto cfg = configset.get();
  check(actor == cfg.manager, "must be manager");
  require_auth(actor);
  assetsa assettable(get_self(), get_self().value);
  auto a = assettable.require_find(token_id, "unrecog token id");
  check(a->symbol == symbol_code(symbol), "mismatched symbol");
  assettable.modify( a, same_payer, [&]( auto& s ) {
    s.active = true;
  });
}

oswaps::poolStatus oswaps::querypool(std::vector<uint64_t> token_id_list){
  poolStatus rv;
  assetsa assettable(get_self(), get_self().value);
  for (const uint64_t& token_id : token_id_list) {
    auto a = assettable.require_find(token_id, "unrecog token id in query list");
    name contract = a->contract_name;
    accounts accttable(contract, get_self().value);
    auto ac = accttable.find(a->symbol.raw());
    stats stattable(contract, a->symbol.raw());
    auto st = stattable.require_find(a->symbol.raw(), "can't stat symbol");
    asset balance(0, st->supply.symbol);
    if(ac != accttable.end()) {
      balance.amount = ac->balance.amount;
    }
    statusEntry e;
    e.token_id = token_id;
    e.balance = balance;
    e.weight = a->weight;
    rv.status_entries.push_back(e);
  }
  return rv;
}

void oswaps::createasseta(name actor, string chain, name contract, symbol_code symbol, string meta) {
  require_auth(actor);
  check(contract != get_self(), "asset contract cannot be oswaps");
  assetsa assettable(get_self(), get_self().value);
  // TODO parse chain into chain_name, chain_code
  string chain_name = "Telos";
  checksum256 chain_code = telos_chain_id;
  check(chain == chain_name, "currently only Telos chain supported");
  configs configset(get_self(), get_self().value);
  auto cfg = configset.get();
  cfg.last_token_id += 1;
  configset.set(cfg, get_self());
  assettable.emplace(actor, [&]( auto& s ) {
    s.token_id = cfg.last_token_id;
    s.chain_code = chain_code;
    s.contract_name = contract;
    s.symbol = symbol;
    s.active = false;
    s.metadata = meta;
    s.weight = 0.0;
  });
  // create LIQ token with correct precision
  stats astattable(contract, symbol.raw());
  auto ast = astattable.require_find(symbol.raw(), "can't stat symbol");
  auto liq_sym_code = symbol_code(sym_from_id(cfg.last_token_id, "LIQ"));
  auto liq_sym = eosio::symbol(liq_sym_code, ast->supply.symbol.precision());
  printf("liq sym code id %llu %s %s", cfg.last_token_id,
            liq_sym_code.to_string().c_str(),
            name(liq_sym_code.raw()).to_string().c_str());
  stats lstattable(get_self(), liq_sym_code.raw());
  auto existing = lstattable.find(liq_sym_code.raw());
  //check( existing == lstattable.end(), "liquidity token already exists");
  if (existing != lstattable.end()) { // corner case from clumsy reset
    lstattable.modify( existing, get_self(), [&]( auto& s ) {
      s.supply      = asset(0, liq_sym);
      s.max_supply  = asset(asset::max_amount, liq_sym);
      s.issuer      = get_self();
    });
  } else {
    lstattable.emplace( get_self(), [&]( auto& s ) {
      s.supply.symbol = liq_sym;
      s.max_supply    = asset(asset::max_amount, liq_sym);
      s.issuer        = get_self();
    }); 
  } 
}

void oswaps::forgetasset(name actor, uint64_t token_id, string memo) {
  configs configset(get_self(), get_self().value);
  check(configset.exists(), "not configured.");
  auto cfg = configset.get();
  check(actor == cfg.manager, "must be manager");
  require_auth(actor);
  assetsa assettable(get_self(), get_self().value);
  auto a = assettable.require_find(token_id, "unrecog token id");
  assettable.erase(a);
  // should we check for zero balance before destroying LIQ token?
  auto liq_sym_code = symbol_code(sym_from_id(token_id, "LIQ"));
  stats lstattable(get_self(), liq_sym_code.raw());
  auto lst = lstattable.begin();
  while ( lst != lstattable.end()) {
    lst = lstattable.erase(lst);
  }
  // accounts table has stranded ram & data which could create weirdness
}  

void oswaps::withdraw(name account, uint64_t token_id, string amount, float weight) {
  configs configset(get_self(), get_self().value);
  check(configset.exists(), "not configured.");
  auto cfg = configset.get();
  require_auth(cfg.manager);
  assetsa assettable(get_self(), get_self().value);
  auto a = assettable.require_find(token_id, "unrecog token id");
  // TODO verify chain, family, and contract
  stats stattable(a->contract_name, a->symbol.raw());
  auto st = stattable.require_find(a->symbol.raw(), "can't stat symbol");
  uint64_t amount64 = amount_from(st->supply.symbol, amount);
  asset qty = asset(amount64, st->supply.symbol);
  accounts accttable(a->contract_name, get_self().value);
  auto ac = accttable.find(a->symbol.raw());
  uint64_t bal_before = 0;
  if(ac != accttable.end()) {
    bal_before = ac->balance.amount;
  }
  check(bal_before > amount64, "withdraw: insufficient balance");
  float new_weight = weight;
  if(weight == 0.0) {
    new_weight = a->weight * (1.0 - float(amount64)/bal_before);
  }
  assettable.modify(a, same_payer, [&](auto& s) {
    s.weight = new_weight;
    s.active &= (weight == 0.0);
  });
  // burn LIQ tokens 
  cfg.withdraw_flag = true;
  configset.set(cfg, get_self());
  // send the LIQ tokens home to retire
  auto liq_sym_code = symbol_code(sym_from_id(token_id, "LIQ"));
  stats lstatstable( get_self(), liq_sym_code.raw() );
  const auto& lst = lstatstable.get( liq_sym_code.raw() );
  asset lqty = qty;
  lqty.symbol = symbol(liq_sym_code, qty.symbol.precision());
  action (
    permission_level{get_self(), "active"_n},
    get_self(),
    "transfer"_n,
    std::make_tuple(account, get_self(), lqty, std::string("oswaps withdrawal"))
  ).send();
  // send out the withdrawn tokens 
  action (
    permission_level{get_self(), "active"_n},
    a->contract_name,
    "transfer"_n,
    std::make_tuple(get_self(), account, qty, std::string("oswaps withdrawal"))
  ).send(); 
}

void oswaps::addliqprep(name account, uint64_t token_id,
                            string amount, float weight) {
                          
  save_transaction("addliqprep"_n, token_id);

}

void oswaps::exprepfrom(
           name sender, name recipient, uint64_t in_token_id, uint64_t out_token_id,
           string in_amount, string memo) {
  save_transaction("exprepfrom"_n, in_token_id);
}

void oswaps::exprepto(
           name sender, name recipient, uint64_t in_token_id, uint64_t out_token_id,
           string out_amount, string memo) {
  save_transaction("exprepto"_n, in_token_id);
}

void oswaps::transfer( const name& from, const name& to, const asset& quantity,
                       const string&  memo ) {
  // implement eosio.token transfer action for LIQ tokens, but restrict p2p trading
    check( from != to, "cannot transfer to self" );
    // should this no-p2p restriction be under manager config control?
    check( from == get_self() || to == get_self(), "oswaps token transfers must be to/from contract");
    if (!has_auth(get_self())) {
      require_auth( from ); // only needed if we enable p2p LIQ transfers
    }
    check( is_account( to ), "to account does not exist");
    auto sym = quantity.symbol.code();
    stats statstable( get_self(), sym.raw() );
    const auto& st = statstable.get( sym.raw() );

    // note that require_recipient does not self-notify the oswaps contract
    require_recipient( from );
    require_recipient( to );

    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount >= 0, "transfer quantity is negative" ); // 0 qty => open account
    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    auto payer = has_auth( to ) ? to : from;

    sub_balance( from, quantity );
    add_balance( to, quantity, payer );
    
    // check whether this transfer is inline action from 'withdraw'
    configs configset(get_self(), get_self().value);
    if(!configset.exists()) { return; }
    auto cfg = configset.get();
    if (!cfg.withdraw_flag) { return; }
    cfg.withdraw_flag = false;
    configset.set(cfg, get_self());    
    action (
      permission_level{get_self(), "active"_n},
      get_self(),
      "retire"_n,
      std::make_tuple(quantity, std::string("oswaps withdrawal"))
    ).send();
}

   
void oswaps::ontransfer(name from, name to, eosio::asset quantity, string memo) {
    // check if there is a stored transaction
    // if not, this is an unrestricted transfer into oswaps
    // [should we also require a confirming memo field?]
    txx txset(get_self(), get_self().value);
    if (!txset.exists()) { 
      return;
    }

    if (from == get_self()) {
      txset.remove();
      return;
    }

    check(to == get_self(), "This transfer is not for oswaps"); // dispatch error?
    check(quantity.amount >= 0, "transfer quantity must be positive");
    name tkcontract = get_first_receiver();

    // analyze the stored transaction
    auto tx = txset.get();
    size_t size = tx.txdata.length();
    //printf("retrieved serialized tx, size %d ", size);
    transaction trx = unpack<transaction>(tx.txdata.data(), size);
    int action_count = trx.actions.size();
    auto prep_action = trx.actions[action_count-2];
    check (action_count >= 2, "malformed oswaps trx, <2 actions");
    prep_action = trx.actions[action_count-2]; // should be the prep action
    check(prep_action.account == get_self(), "malformed oswaps tx, prep should be next to final");
    name prep_type = prep_action.name;
    assetsa assettable(get_self(), get_self().value);
    
    if (prep_type == "addliqprep"_n) {
      addliqprep_params ap = unpack<addliqprep_params>(prep_action.data.data(), prep_action.data.size());

      auto a = assettable.require_find(ap.token_id, "unrecog token id");
      // TODO verify chain & family
      check(a->contract_name == tkcontract, "transfer token contract mismatched to prep");
      check(a->symbol == quantity.symbol.code(), "transfer symbol mismatched to prep");
      stats stattable(a->contract_name, a->symbol.raw());
      auto st = stattable.require_find(a->symbol.raw(), "can't stat symbol");
      check(st->supply.symbol==quantity.symbol, "transfer symbol/prec mismatched to prep");
      uint64_t amount64 = amount_from(st->supply.symbol, ap.amount);
      check(amount64 == quantity.amount, "transfer qty mismatched to prep");   
      check(a->active || amount64 == 0, "token is frozen");   
      accounts accttable(a->contract_name, get_self().value);
      auto ac = accttable.require_find(a->symbol.raw(), "no pool balance after transfer in");
      // must back out transfer which just occurred
      uint64_t bal_before = ac->balance.amount - quantity.amount;
      float new_weight = ap.weight;
      if(new_weight == 0.0) {
        check(bal_before > 0, "zero weight requires existing balance");
        new_weight = a->weight * (1.0 + float(amount64)/bal_before);
      }
      assettable.modify(a, same_payer, [&](auto& s) {
        s.weight = new_weight;
        s.active &= (ap.weight == 0.0);
      });
      if (quantity.amount > 0) {
        // issue LIQ tokens to self & transfer to `from` account
        auto liq_sym_code = symbol_code(sym_from_id(ap.token_id, "LIQ"));
        stats lstatstable( get_self(), liq_sym_code.raw() );
        const auto& lst = lstatstable.get( liq_sym_code.raw() );
        asset lqty = quantity;
        lqty.symbol = symbol(liq_sym_code, quantity.symbol.precision());
        add_balance( get_self(), lqty, get_self() );
        lstatstable.modify( lst, same_payer, [&]( auto& s ) {
          s.supply += lqty;
        });
        action (
          permission_level{get_self(), "active"_n},
          get_self(),
          "transfer"_n,
          std::make_tuple(get_self(), from, lqty,
             std::string("oswaps liquidity receipt "))
        ).send();
      }
      
    } else if (prep_type == "exprepfrom"_n || prep_type == "exprepto"_n ) {
      // exchange transaction
      name out_contract;
      name sender;
      name recipient;
      asset out_qty;
      string exchange_memo;
      int64_t in_surplus = 0;
      bool input_is_exact = prep_type == "exprepfrom"_n;
      if (input_is_exact) {
        exprepfrom_params efp = unpack<exprepfrom_params>(prep_action.data.data(), prep_action.data.size());
        recipient = efp.recipient;
        sender = efp.sender;
        exchange_memo = efp.memo;
        auto ain = assettable.require_find(efp.in_token_id, "unrecog input token id");
        check(ain->contract_name == tkcontract, "wrong token contract");
        check(ain->symbol == quantity.symbol.code(), "transfer symbol mismatched to prep");
        stats in_stattable(ain->contract_name, ain->symbol.raw());
        auto stin = in_stattable.require_find(ain->symbol.raw(), "can't stat input symbol");
        check(ain->active, "input token swap is frozen");
        uint64_t in_amount64 = amount_from(stin->supply.symbol, efp.in_amount);
        accounts in_accttable(ain->contract_name, get_self().value);
        auto acin = in_accttable.require_find(ain->symbol.raw(), "no pool balance after transfer in");
        // must back out transfer which just occurred
        uint64_t in_bal_before = acin->balance.amount - quantity.amount;
        check(in_bal_before > 0, "zero input balance, can't compute swap");                
        auto aout = assettable.require_find(efp.out_token_id, "unrecog output token id");
        out_contract = aout->contract_name;
        stats out_stattable(aout->contract_name, aout->symbol.raw());
        auto stout = out_stattable.require_find(aout->symbol.raw(), "can't stat output symbol");
        check(aout->active, "output token swap is frozen");
        //uint64_t out_amount64 = amount_from(stout->supply);.symbol, efp.out_amount);
        accounts out_accttable(aout->contract_name, get_self().value);
        auto acout = out_accttable.find(aout->symbol.raw());
        uint64_t out_bal_before = 0;
        if(acout != out_accttable.end()) {
          out_bal_before = acout->balance.amount;
        }

        // do balancer computation 
        double lc, lnc;
        int64_t in_bal_after, out_bal_after, computed_amt;
        in_bal_after = in_bal_before + in_amount64;
        lc = log((double)in_bal_after/in_bal_before);
        lnc = -(ain->weight/aout->weight * lc);
        out_bal_after = llround(out_bal_before * exp(lnc));
        computed_amt = out_bal_before - out_bal_after;

        check(in_amount64 == quantity.amount, "transfer qty mismatched to prep");
        out_qty = asset(computed_amt, stout->supply.symbol);
        
      } else { // output quantity is exact
        exprepto_params etp = unpack<exprepto_params>(prep_action.data.data(), prep_action.data.size());
        recipient = etp.recipient;
        sender = etp.sender;
        exchange_memo = etp.memo;
        auto ain = assettable.require_find(etp.in_token_id, "unrecog input token id");
        check(ain->contract_name == tkcontract, "wrong token contract");
        check(ain->symbol == quantity.symbol.code(), "transfer symbol mismatched to prep");
        stats in_stattable(ain->contract_name, ain->symbol.raw());
        auto stin = in_stattable.require_find(ain->symbol.raw(), "can't stat symbol");
        check(ain->active, "input token swap is frozen");
        //uint64_t in_amount64 = amount_from(stin->supply.symbol, etp.in_amount);
        accounts in_accttable(ain->contract_name, get_self().value);
        auto acin = in_accttable.require_find(ain->symbol.raw(), "no pool balance after transfer in");
        // must back out transfer which just occurred
        uint64_t in_bal_before = acin->balance.amount - quantity.amount;
        check(in_bal_before > 0, "zero input balance, can't compute swap");                
        auto aout = assettable.require_find(etp.out_token_id, "unrecog output token id");
        out_contract = aout->contract_name;
        stats out_stattable(aout->contract_name, aout->symbol.raw());
        auto stout = out_stattable.require_find(aout->symbol.raw(), "can't stat symbol");
        check(aout->active, "output token swap is frozen");
        uint64_t out_amount64 = amount_from(stout->supply.symbol, etp.out_amount);
        accounts out_accttable(aout->contract_name, get_self().value);
        auto acout = out_accttable.find(aout->symbol.raw());
        uint64_t out_bal_before = 0;
        if(acout != out_accttable.end()) {
          out_bal_before = acout->balance.amount;
        }

        double lc, lnc;
        int64_t in_bal_after, out_bal_after, computed_amt;
        out_bal_after = out_bal_before - out_amount64;
        check(out_bal_after > 0, "insufficient pool bal output token");
        lc = log((double)out_bal_after/out_bal_before);
        lnc = -(aout->weight/ain->weight * lc);
        in_bal_after = llround(in_bal_before * exp(lnc));
        computed_amt = in_bal_after - in_bal_before;
        
        in_surplus = quantity.amount - computed_amt;
        check(in_surplus >= 0, "insufficient amount transferred in");
        out_qty = asset(out_amount64, stout->supply.symbol);

      }
    
      // send exchange output to recipient 
      action (
        permission_level{get_self(), "active"_n},
        out_contract,
        "transfer"_n,
        std::make_tuple(get_self(), recipient, out_qty,
          exchange_memo + " (from " + sender.to_string() + " via oswaps)")
      ).send();
      // refund surplus to sender
      if(in_surplus > 0) {
        asset overpayment = asset(in_surplus, quantity.symbol);
        asset netpayment = asset(quantity.amount-in_surplus, quantity.symbol);
        action (
          permission_level{get_self(), "active"_n},
          tkcontract,
          "transfer"_n,
          std::make_tuple(get_self(), sender, overpayment,
            std::string("oswaps exchange refund overpayment, net is ")+netpayment.to_string())
        ).send();
      }
    } else {
      check(false, "malformed oswaps trx: invalid prep action");
    }

    txset.remove();
}

void oswaps::sub_balance( const name& owner, const asset& value ) {
   accounts from_acnts( get_self(), owner.value );
   
   const auto& from = from_acnts.get( value.symbol.code().raw(),
     (value.symbol.code().to_string()+": no balance entry for "
     + owner.to_string()).c_str() );
   check( from.balance.amount >= value.amount,
     (value.symbol.code().to_string()+": overdrawn balance for "
     + owner.to_string()).c_str() );

   from_acnts.modify( from, same_payer, [&]( auto& a ) {
         a.balance -= value;
      });
}

void oswaps::add_balance( const name& owner, const asset& value, const name& ram_payer )
{
   accounts to_acnts( get_self(), owner.value );
   auto to = to_acnts.find( value.symbol.code().raw() );
   if( to == to_acnts.end() ) {
      to_acnts.emplace( ram_payer, [&]( auto& a ){
        a.balance = value;
      });
   } else {
      to_acnts.modify( to, same_payer, [&]( auto& a ) {
        a.balance += value;
      });
   }
}

void oswaps::retire( const asset& quantity, const string& memo )
{
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist" );
    const auto& st = *existing;

    require_auth( st.issuer );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must retire positive quantity" );

    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply -= quantity;
    });

    sub_balance( st.issuer, quantity );
}

