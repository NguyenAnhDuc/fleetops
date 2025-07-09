<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddFeesTypeAndCurrencyTypeToOrdersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->integer('is_fees_type_by_order')->default(true)->after('fees_driver');
            $table->integer('quantity_fees')->default(1)->after('is_fees_type_by_order');
            $table->integer('unit_price_fees')->default(0)->after('quantity_fees');
            $table->boolean('is_receive_cash_fees')->default(value: true)->after('unit_price_fees');
            $table->integer('approval_fees')->default(0)->after('is_receive_cash_fees');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('is_fees_type_by_order');
            $table->dropColumn('quantity_fees');
            $table->dropColumn('unit_price_fees');
            $table->dropColumn('is_receive_cash_fees');
            $table->dropColumn('approval_fees');
        });
    }
}