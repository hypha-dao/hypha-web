/** @type {Record<string, string>} */
export default {
  title: 'Banküberweisungen',
  subtitle:
    'Empfangen Sie Banküberweisungen in Ihrer Treasury und verwalten Sie Einzahlungskonten des Space.',
  loading: 'Bankkontostatus wird geladen…',
  returnBanner:
    'Willkommen zurück — wir prüfen Ihren Verifizierungsstatus.',
  returnBannerDismiss: 'Schließen',
  returnBannerApprovedHint:
    'Die Verifizierung ist abgeschlossen. Eröffnen Sie ein Space-Konto, um fehlende Währungen hinzuzufügen.',
  errorLoad: 'Bankkontostatus konnte nicht geladen werden.',
  'sections.transfers.title': 'Einmalige Banküberweisungen',
  'sections.transfers.description': 'Einmalige eingehende Überweisungen.',
  'sections.transfers.emptyTitle': 'Noch keine einmaligen Überweisungen',
  'sections.transfers.emptyDescription':
    'Erstellen Sie eine einmalige Überweisung, wenn Sie eine einzelne eingehende Zahlung benötigen, ohne ein vollständiges Einzahlungskonto einzurichten.',
  'sections.transfers.newTransferCta': 'Neue einmalige Überweisung',
  'sections.transfers.loading': 'Überweisungen werden geladen…',
  'sections.accounts.title': 'Bankkonten',
  'sections.accounts.description': 'Permanente Einzahlungsdetails pro Währung.',
  'sections.accounts.openAccountCta': 'Space-Konto eröffnen',
  'sections.accounts.addCurrencyCta': 'Bankkonto hinzufügen',
  'sections.accounts.emptyTitle': 'Noch keine Bankkonten',
  'sections.accounts.emptyDescription':
    'Eröffnen Sie ein Space-Konto und wählen Sie die benötigten Währungen. Wir richten für jede Währung Einzahlungsdetails ein.',
  'sections.accounts.pendingTitle': 'Verifizierung läuft',
  'sections.accounts.pendingDescription':
    'Schließen Sie die Verifizierung in Bridge ab, um die ausgewählten Währungen zu aktivieren. Ihre Konten werden nach der Freigabe automatisch erstellt.',
  'sections.accounts.continueVerificationCta': 'Verifizierung fortsetzen',
  'sections.accounts.loadingAccounts': 'Bankkonten werden geladen…',
  'sections.accounts.signInHint': 'Melden Sie sich an, um Bankkonten zu verwalten.',
  'openAccount.title': 'Space-Konto eröffnen',
  'openAccount.titleAddCurrency': 'Bankkonto hinzufügen',
  'openAccount.description':
    'Teilen Sie uns mit, welche Organisation Sie vertreten und welche Währungen Sie benötigen. Wir verifizieren Ihren Space einmalig und erstellen anschließend Konten für jede Währung.',
  'openAccount.descriptionAddCurrency':
    'Wählen Sie zusätzliche Währungen, für die Sie Einzahlungskonten für Ihren Space hinzufügen möchten.',
  'openAccount.descriptionAddCurrencySingle':
    'Wählen Sie die Einzahlungswährung für dieses Bankkonto. Möglicherweise ist eine zusätzliche Verifizierung beim Anbieter erforderlich.',
  'openAccount.bankAccountDepositLabel': 'Einzahlungswährung',
  'openAccount.bankAccountDepositHint':
    'Währung, die dieses Bankkonto empfängt.',
  'openAccount.legalName': 'Rechtlicher Name der Organisation',
  'openAccount.contactEmail': 'Kontakt-E-Mail',
  'openAccount.currenciesLabel': 'Währungen',
  'openAccount.currenciesHint':
    'Wählen Sie alle Währungen, in denen Sie Banküberweisungen empfangen möchten.',
  'openAccount.currenciesHintSingle':
    'Wählen Sie eine Währung, in der Sie Banküberweisungen empfangen möchten.',
  'openAccount.submit': 'Konto eröffnen',
  'openAccount.submitAddCurrency': 'Bankkonto hinzufügen',
  'openAccount.submitting': 'Wird bearbeitet…',
  'openAccount.noCurrenciesAvailable':
    'Alle unterstützten Bankkonten sind für diesen Space bereits eröffnet.',
  'openAccount.railLabel': 'Zahlungsweg',
  'openAccount.railPlaceholder': 'Zahlungsweg auswählen',
  'openAccount.requestRail': 'Anfordern',
  'openAccount.loadingOptions': 'Wird geladen…',
  'openAccount.railsNeedVerificationHint':
    'Für diese Zahlungswege ist eine Anbieterverifizierung erforderlich, bevor Sie sie nutzen können.',
  'openAccount.provisioningProgress': '{currency}-Konto wird erstellt…',
  'openAccount.redirectPendingTitle': 'In Bridge fortfahren',
  'openAccount.redirectPendingDescription':
    'Akzeptieren Sie die Bedingungen und schließen Sie die Verifizierung ab, um die ausgewählten Währungen zu aktivieren.',
  'toolbar.add': 'Hinzufügen',
  'toolbar.addCurrency': 'Bankkonto hinzufügen',
  'toolbar.openSpaceAccount': 'Space-Konto eröffnen',
  'toolbar.finishVerificationFirst':
    'Schließen Sie zuerst die laufende Verifizierung ab',
  'toolbar.allCurrenciesCovered':
    'Für alle unterstützten Währungen existieren bereits Konten',
  'toolbar.loadingAccounts': 'Bankkonten werden geladen…',
  'toolbar.loadingTransfers': 'Überweisungen werden geladen…',
  'operationStatus.pendingKyb': 'Verifizierung ausstehend',
  'operationStatus.pendingActivation': 'Bereit zur Aktivierung',
  'operationStatus.pendingKybHint':
    'Schließen Sie die Unternehmensverifizierung in Bridge ab, um diese Anfrage zu aktivieren.',
  'operationStatus.pendingActivationHint':
    'Die Verifizierung ist abgeschlossen. Aktivieren Sie, um Einzahlungsanweisungen zu generieren.',
  'operationStatus.continueVerification': 'Verifizierung fortsetzen',
  'operationStatus.completeSetup': 'Aktivieren',
  'operationStatus.activating': 'Wird aktiviert…',
  'operationStatus.activateFailed':
    'Die Einrichtung konnte nicht abgeschlossen werden. Bitte versuchen Sie es später erneut. Wenn das Problem bestehen bleibt, kontaktieren Sie uns.',
  'operationStatus.openGearForVerification':
    'Klicken Sie, um Verifizierungsdetails und Bridge-Links zu öffnen.',
  'advanced.gearLabel': 'Banking-Einstellungen',
  'advanced.dialogTitle': 'Banking-Einstellungen',
  'advanced.dialogDescription':
    'Detaillierte Informationen und technische Konfigurationen.',
  'advanced.dataMinimizationNotice':
    'Einzahlungs- und Verifizierungsdetails werden von unserem Banking-Partner geladen und nicht auf Hypha-Servern gespeichert.',
  'advanced.noCustomer':
    'Für diesen Space existiert noch kein Bankkunden-Datensatz.',
  'advanced.approvedSummary':
    'Die Verifizierung ist genehmigt. Verwalten Sie Konten im Abschnitt Bankkonten unten.',
  'advanced.providerValidationsTitle': 'Anbieterprüfungen',
  'advanced.legalNameLabel': 'Rechtlicher Name der Organisation',
  'advanced.contactEmailLabel': 'Kontakt-E-Mail',
  'advanced.stepCompleted': 'Abgeschlossen',
  'advanced.tosProcedure': 'Nutzungsbedingungen',
  'advanced.kybProcedure': 'Unternehmensverifizierung (KYB)',
  'advanced.approvedOnBridgePendingRecord':
    'Bridge zeigt die Verifizierung als genehmigt an. Aktivieren Sie unten eine ausstehende Anfrage, um die Freigabe zu erfassen und die Einrichtung abzuschließen.',
  'advanced.currencyValidationsTitle': 'Währungsprüfungen',
  'advanced.currencyStatusesTitle': 'Währungskorridore',
  'advanced.currencyStatusesDescription':
    'Endorsement-Status pro Währung von Bridge und Fortschritt der Kontoeinrichtung.',
  'advanced.currencyStatusesDescriptionAdd':
    'Unterstützung für einen Währungskorridor hinzufügen. Bridge kann für einige Regionen eine zusätzliche Verifizierung verlangen.',
  'advanced.addCurrencySupport': '{currency}-Konto eröffnen',
  'advanced.currencyStatus.active': 'Aktiv',
  'advanced.currencyStatus.approved': 'Genehmigt',
  'advanced.currencyStatus.pending': 'Verifizierung ausstehend',
  'advanced.currencyStatus.not_approved': 'Nicht genehmigt',
  'advanced.currencyStatus.not_requested': 'Nicht angefordert',
  'advanced.currencyStatus.not_opened': 'Nicht eröffnet',
  'advanced.syncStatus': 'Status synchronisieren',
  'advanced.syncingStatus': 'Wird synchronisiert…',
  'advanced.procedureHints.fallback':
    'Für diesen Schritt in Bridge ist derzeit keine weitere Aktion erforderlich.',
  'advanced.procedureHints.tos.complete':
    'Die Nutzungsbedingungen wurden akzeptiert. Hier ist keine weitere Aktion erforderlich.',
  'advanced.procedureHints.tos.pending':
    'Die Nutzungsbedingungen sind in Bridge noch ausstehend.',
  'advanced.procedureHints.kyb.complete':
    'Die Unternehmensverifizierung ist abgeschlossen. Hier ist keine weitere Aktion erforderlich.',
  'advanced.procedureHints.kyb.not_started':
    'Öffnen Sie den Verifizierungslink, um die Verifizierung Ihrer Organisation zu starten.',
  'advanced.procedureHints.kyb.incomplete':
    'Füllen Sie das Verifizierungsformular in Bridge aus und reichen Sie es ein, um fortzufahren.',
  'advanced.procedureHints.kyb.awaiting_questionnaire':
    'Bridge benötigt zusätzliche Informationen. Prüfen Sie Ihre E-Mail oder das Verifizierungsportal auf den Fragebogen.',
  'advanced.procedureHints.kyb.awaiting_ubo':
    'Es wird auf die in der KYB-Formular angegebenen wirtschaftlich Berechtigten (UBOs) gewartet, die die per E-Mail gesendete Verifizierung abschließen müssen.',
  'advanced.procedureHints.kyb.under_review':
    'Ihre Einreichung wird von Bridge geprüft. Dies kann von wenigen Stunden bis zu mehreren Tagen dauern.',
  'advanced.procedureHints.kyb.approved':
    'Die Unternehmensverifizierung ist abgeschlossen. Hier ist keine weitere Aktion erforderlich.',
  'advanced.procedureHints.kyb.rejected':
    'Die Verifizierung wurde abgelehnt. Kontaktieren Sie den Support, wenn Sie glauben, dass dies ein Fehler ist.',
  'advanced.procedureHints.kyb.paused':
    'Die Verifizierung ist pausiert. Kontaktieren Sie den Support.',
  'advanced.procedureHints.kyb.offboarded':
    'Die Banking-Verifizierung ist für diesen Kunden nicht mehr verfügbar. Kontaktieren Sie den Support.',
  'tosStatus.pending.title': 'Bedingungen nicht akzeptiert',
  'tosStatus.pending.description':
    'Akzeptieren Sie die Nutzungsbedingungen, um fortzufahren.',
  'tosStatus.approved.title': 'Bedingungen akzeptiert',
  'tosStatus.approved.description':
    'Die Nutzungsbedingungen wurden akzeptiert.',
  'currencies.eur.code': 'EUR',
  'currencies.eur.name': 'Euro',
  'currencies.eur.payoutMethod': 'IBAN und SWIFT/BIC',
  'currencies.usd.code': 'USD',
  'currencies.usd.name': 'US-Dollar',
  'currencies.usd.payoutMethod': 'ACH-Routing- und Kontonummer',
  'currencies.gbp.code': 'GBP',
  'currencies.gbp.name': 'Britisches Pfund',
  'currencies.gbp.payoutMethod': 'Sort Code und Kontonummer',
  'currencies.mxn.code': 'MXN',
  'currencies.mxn.name': 'Mexikanischer Peso',
  'currencies.mxn.payoutMethod': 'CLABE-Überweisung',
  'currencies.brl.code': 'BRL',
  'currencies.brl.name': 'Brasilianischer Real',
  'currencies.brl.payoutMethod': 'PIX',
  'currencies.cop.code': 'COP',
  'currencies.cop.name': 'Kolumbianischer Peso',
  'currencies.cop.payoutMethod': 'Bre-B',
  'initialSetup.organizationLegend': 'Organisationsdetails',
  'initialSetup.organizationHint':
    'Organisationsdetails werden zur Verifizierung an unseren Banking-Partner übermittelt und nicht auf Hypha gespeichert.',
  'initialSetup.currenciesTitle': 'Gewünschte Währungen',
  'initialSetup.currenciesDescription':
    'Wählen Sie die Währungen, die dieser Space per Banküberweisung akzeptieren soll. Wir verifizieren Ihre Organisation einmalig bei unserem Banking-Partner.',
  'initialSetup.currenciesHint':
    'Weitere Währungen können Sie später in den Banking-Einstellungen hinzufügen.',
  'initialSetup.submit': 'Weiter',
  'notStarted.description':
    'Banking ist für diesen Space noch nicht eingerichtet.',
  'notStarted.enableCta': 'Weiter',
  'blockers.notOnChain':
    'Dieser Space muss on-chain bereitgestellt sein, bevor ein verknüpftes Bankkonto eingerichtet werden kann.',
  'blockers.noTreasury':
    'Dieser Space benötigt eine on-chain Treasury-Adresse, bevor ein verknüpftes Bankkonto eingerichtet werden kann.',
  verificationInProgress:
    'Die Verifizierung läuft. Dies dauert in der Regel von wenigen Stunden bis zu einigen Tagen. Wenn Sie handeln müssen, nutzen Sie den Link unten.',
  'actions.openVerificationForm': 'Verifizierungsformular öffnen',
  'actions.viewTerms': 'Nutzungsbedingungen anzeigen',
  'actions.refreshStatus': 'Status aktualisieren',
  'actions.refreshingStatus': 'Status wird geprüft…',
  'corridors.provisioning': 'Wird eingerichtet…',
  'corridors.allActive': 'Alle unterstützten Währungen sind aktiv.',
  'corridors.addDisabledNotManager':
    'Nur Space-Mitglieder mit Treasury-Zugriff können Bankkonten verwalten.',
  'accountCard.viewDetails': 'Details anzeigen',
  'transferCard.viewDetails': 'Details anzeigen',
  'transferCard.flexibleAmount': 'Beliebiger Betrag',
  'transferCard.feeHint':
    'Entwicklergebühr: 0 % · Anbietergebühren können anfallen',
  'transferDetails.title': 'Einmalige Überweisung',
  'transferDetails.description':
    'Der Zahler muss die Referenznachricht bei seiner Banküberweisung angeben, damit Bridge die Einzahlung zuordnen kann.',
  'transferDetails.referenceWarning':
    'Der Absender muss die untenstehende Zahlungsreferenz im Wire-Memo, in der ACH-Beschreibung oder in der SEPA-Referenz angeben. Ohne diese kann der Anbieter die Einzahlung nicht zuordnen.',
  'transferDetails.amountLabel': 'Betrag',
  'transferDetails.flexibleAmount': 'Beliebiger Betrag',
  'transferDetails.receiptHeading': 'Zahlungsbeleg',
  'transferDetails.finalAmount': 'In Treasury erhalten',
  'transferDetails.gasFee': 'Netzwerkgebühr (Gas)',
  'transferDetails.exchangeFee': 'Wechselgebühr',
  'transferDetails.destinationTx': 'Treasury-Transaktion',
  'transferDetails.viewProviderReceipt': 'Anbieterbeleg anzeigen',
  'transferDetails.receiptFields.transferId': 'Transfer-ID',
  'transferDetails.receiptFields.state': 'Status',
  'transferDetails.receiptFields.amount': 'Betrag',
  'transferDetails.receiptFields.developerFee': 'Entwicklergebühr',
  'transferDetails.receiptFields.source': 'Quelle',
  'transferDetails.receiptFields.createdAt': 'Erstellt',
  'transferDetails.receiptFields.updatedAt': 'Aktualisiert',
  'transferDetails.receiptFields.destinationRail': 'Ziel',
  'transferDetails.receiptFields.destinationAddress': 'Treasury-Adresse',
  'transferDetails.receiptFields.initialAmount': 'Anfangsbetrag',
  'transferDetails.receiptFields.subtotalAmount': 'Zwischensumme',
  'transferDetails.receiptFields.finalAmount': 'Endbetrag',
  'transferDetails.receiptFields.exchangeFee': 'Wechselgebühr',
  'transferDetails.receiptFields.gasFee': 'Netzwerkgebühr (Gas)',
  'transferDetails.receiptFields.receiptDeveloperFee':
    'Entwicklergebühr laut Beleg',
  'transferDetails.receiptFields.destinationTx': 'Treasury-Transaktion',
  'transferDetails.receiptFields.receiptUrl': 'URL des Anbieterbelegs',
  'transferCorridors.usd-ach.label': 'USD — lokal (ACH)',
  'transferCorridors.usd-ach.hint':
    'Inlandsüberweisungen in den USA via ACH',
  'transferCorridors.usd-wire.label': 'USD — international (Wire)',
  'transferCorridors.usd-wire.hint':
    'Internationale Wire-Überweisungen in US-Dollar',
  'transferCorridors.eur.label': 'EUR',
  'transferCorridors.eur.hint': 'SEPA-Überweisungen in Euro',
  'transferCorridors.gbp.label': 'GBP',
  'transferCorridors.gbp.hint': 'Faster Payments in Britischen Pfund',
  'transferCorridors.mxn.label': 'MXN',
  'transferCorridors.mxn.hint': 'SPEI-Überweisungen in Mexikanischen Pesos',
  'transferCorridors.brl.label': 'BRL',
  'transferCorridors.brl.hint': 'PIX-Überweisungen in Brasilianischen Real',
  'transferCorridors.cop.label': 'COP (Beta)',
  'transferCorridors.cop.hint': 'Bre-B-Überweisungen in Kolumbianischen Pesos',
  'createTransfer.title': 'Neue einmalige Überweisung',
  'createTransfer.description':
    'Erstellen Sie Einzahlungsanweisungen für eine einzelne eingehende Überweisung. Die Mittel werden in USDC in Ihrer Treasury umgewandelt.',
  'createTransfer.corridorLabel': 'Korridor',
  'createTransfer.corridorHint':
    'Wählen Sie, wie der Zahler Mittel sendet. Dies bestimmt die Einzahlungsanweisungen.',
  'createTransfer.fixedAmountLabel': 'Festen Betrag verlangen',
  'createTransfer.amountPlaceholder': 'z. B. 1000,00',
  'createTransfer.flexibleAmountHint': 'Der Zahler kann einen beliebigen Betrag senden.',
  'createTransfer.cancel': 'Abbrechen',
  'createTransfer.submit': 'Überweisung erstellen',
  'createTransfer.submitting': 'Wird erstellt…',
  'createTransfer.loadingOptions': 'Korridore werden geladen…',
  'createTransfer.noCorridorsAvailable':
    'Für diesen Space sind keine Transferkorridore verfügbar.',
  'transferStatus.awaiting_funds': 'Zahlung ausstehend',
  'transferStatus.funds_received': 'Erhalten',
  'transferStatus.payment_processed': 'Abgeschlossen',
  'transferStatus.canceled': 'Storniert',
  'transferStatus.cancelled': 'Storniert',
  'transferStatus.failed': 'Fehlgeschlagen',
  'transferStatus.returned': 'Zurückgegeben',
  'transferStatus.in_review': 'In Prüfung',
  'transferStatus.undeliverable': 'Nicht zustellbar',
  'depositInstructions.iban': 'IBAN',
  'depositInstructions.bic': 'BIC / SWIFT',
  'depositInstructions.bicInternational':
    'BIC / SWIFT (für internationale Überweisungen)',
  'depositInstructions.routingNumber': 'Routing-Nummer',
  'depositInstructions.accountNumber': 'Kontonummer',
  'depositInstructions.sortCode': 'Sort Code',
  'depositInstructions.bankName': 'Bankname',
  'depositInstructions.accountHolder': 'Kontoinhaber',
  'depositInstructions.bankNameAndAddress': 'Bankname und -adresse',
  'depositInstructions.beneficiaryNameAndAddress':
    'Name und Adresse des Begünstigten',
  'depositInstructions.activeBadge': 'Aktiv',
  'depositInstructions.depositMessage': 'Referenznachricht (erforderlich)',
  'depositInstructions.bankInstructionsSection': 'Anweisungen zur Banküberweisung',
  'depositInstructions.treasurySection': 'Treasury-Ziel',
  'depositInstructions.destinationCurrency': 'Zielwährung',
  'depositInstructions.destinationRail': 'Zahlungsweg',
  'depositInstructions.destinationAddress': 'Treasury-Adresse',
  'depositInstructions.hyphaFees': 'Hypha-Gebühren',
  'depositInstructions.feesUnavailable': 'Vom Anbieter nicht angegeben',
  'depositInstructions.providerFeesNote':
    '*Der Anbieter kann bei Transaktionen zusätzliche Gebühren erheben.',
  'depositInstructions.copyInstructions': 'Anweisungen kopieren',
  'depositInstructions.copyInstructionsCopied': 'Kopiert',
  'depositInstructions.copy': 'Kopieren',
  'depositInstructions.copied': 'Kopiert',
  'sandboxDemo.title': 'Sandbox / Dev — KYB-Simulation',
  'sandboxDemo.description':
    'KYB ist ein manueller Schritt und muss in der Sandbox simuliert werden. Dies kann auch das vollständige Ausfüllen des Formulars umgehen.',
  'sandboxDemo.infoTooltipAria': 'Über KYB-Simulation in der Sandbox',
  'sandboxDemo.simulateFillingKybRequiredData':
    'Ausfüllen der erforderlichen KYB-Daten simulieren',
  'sandboxDemo.cta': 'KYB-Freigabe simulieren',
  'sandboxDemo.simulating': 'Wird simuliert…',
  'sandboxDemo.refreshing': 'Status wird aktualisiert…',
  'endorsements.base': 'USD (ACH / Wire Transfer)',
  'endorsements.cop': 'COP (Bre-B, Kolumbien)',
  'endorsements.faster_payments': 'GBP (Faster Payments, UK)',
  'endorsements.pix': 'BRL (PIX, Brasilien)',
  'endorsements.sepa': 'EUR (SEPA-Überweisung)',
  'endorsements.spei': 'MXN (SPEI, Mexiko)',
  'onboardingDialog.title': 'Bankeinzahlungen aktivieren',
  'onboardingDialog.description':
    'Diese Angaben dienen der Verifizierung Ihrer Organisation. Nach der Freigabe wird Ihr Space für den Empfang von Banküberweisungen eingerichtet.',
  'onboardingDialog.legalName': 'Rechtlicher Name der Organisation',
  'onboardingDialog.contactEmail': 'Kontakt-E-Mail',
  'onboardingDialog.endorsementsLabel': 'Zahlungskorridore',
  'onboardingDialog.endorsementsHint':
    'Dies sind Bridge-KYB-Endorsements (z. B. base für USD, sepa für EUR). Jeder ausgewählte Korridor ist im Verifizierungslink enthalten.',
  'onboardingDialog.submit': 'Verifizierung starten',
  'onboardingDialog.submitting': 'Wird gestartet…',
  'status.not_started.title': 'Verifizierung nicht gestartet',
  'status.not_started.description':
    'Öffnen Sie den Verifizierungslink, um die Angaben Ihrer Organisation zu übermitteln.',
  'status.incomplete.title': 'Verifizierung unvollständig',
  'status.incomplete.description':
    'Ihr Verifizierungsformular wurde noch nicht eingereicht.',
  'status.awaiting_questionnaire.title': 'Zusätzliche Angaben erforderlich',
  'status.awaiting_questionnaire.description':
    'Bitte füllen Sie den zusätzlichen Fragebogen aus, um die Verifizierung fortzusetzen.',
  'status.awaiting_ubo.title': 'UBO-Verifizierung ausstehend',
  'status.awaiting_ubo.description':
    'Es wird auf die in der KYB-Formular angegebenen wirtschaftlich Berechtigten (UBOs) gewartet, die die per E-Mail gesendete Verifizierung abschließen müssen.',
  'status.under_review.title': 'In Prüfung',
  'status.under_review.description':
    'Ihre Verifizierung wurde eingereicht und wird geprüft. Dies kann von wenigen Stunden bis zu mehreren Tagen dauern.',
  'status.approved.title': 'Verifizierung genehmigt',
  'status.approved.description':
    'Ihre Organisation wurde verifiziert. Fügen Sie unten Währungen hinzu, um Einzahlungskonten zu eröffnen.',
  'status.rejected.title': 'Verifizierung abgelehnt',
  'status.rejected.description':
    'Ihre Organisation konnte nicht verifiziert werden. Kontaktieren Sie den Support, wenn Sie glauben, dass dies ein Fehler ist.',
  'status.paused.title': 'Verifizierung pausiert',
  'status.paused.description':
    'Die Verifizierung ist vorübergehend pausiert. Kontaktieren Sie den Support.',
  'status.offboarded.title': 'Verknüpftes Bankkonto nicht verfügbar',
  'status.offboarded.description':
    'Verknüpfte Bankkonten sind für diesen Space nicht mehr verfügbar. Kontaktieren Sie den Support.',
  'status.unknown.title': 'Status nicht verfügbar',
  'status.unknown.description':
    'Der aktuelle Verifizierungsstatus konnte nicht ermittelt werden. Versuchen Sie zu aktualisieren.',
};
